import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { appendActivityEvents, parseHistoryCursor, publishActivityEvents, serializeHistoryCursor } from "./activity";
import { hashPassword } from "./password";
import { prisma } from "./prisma";
import { buildGuestTableLink } from "./public-url";
import { getReviewHistoryPage, getWaiterReviewMetricsMap } from "./reviews";
import {
  ApiError,
  asFloorPlan,
  ensureManager,
  ensureWaiter,
  getActiveSession,
  getAssignedWaiterId,
  getWaiterAssignmentsMap,
  loadManagerProfile,
  normalizeWaiter,
  toBillLine,
  toHallTable,
  toReviewPrompt,
  toServiceRequest,
  type TableRecord,
} from "./projections";
import { getRestaurantData, updateRestaurantProfile, type RestaurantProfileInput } from "./restaurant";
import type {
  CreateWaiterInput,
  DishInput,
  FloorTableNode,
  FloorTableShape,
  FloorTableSizePreset,
  FloorZone,
  ManagerHallResponse,
  ManagerHistoryEntry,
  ManagerHistoryPage,
  ManagerLayoutSnapshot,
  ManagerMenuSnapshot,
  ManagerTableDetail,
  ManagerTableNode,
  ManagerTableSummary,
  ManagerWaiterDetail,
  ManagerWaiterSummary,
  MenuCategoryInput,
  ReplaceWaiterAssignmentsInput,
  ReviewHistoryPage,
  ResetWaiterPasswordInput,
  UpdateLayoutInput,
  UpdateWaiterInput,
  WaiterProfile,
} from "./types";

type ManagerTableRecord = TableRecord;

const ACTIVE_TABLE_INCLUDE = {
  assignments: {
    where: { endedAt: null },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: { waiter: true },
  },
  sessions: {
    where: { closedAt: null },
    orderBy: { startedAt: "desc" as const },
    take: 1,
    include: {
      requests: {
        orderBy: { createdAt: "desc" as const },
      },
      billLines: {
        orderBy: { createdAt: "asc" as const },
      },
      waiterTasks: {
        orderBy: { createdAt: "desc" as const },
      },
      waiterOrderBatches: {
        orderBy: { createdAt: "desc" as const },
        include: {
          billLines: {
            orderBy: { createdAt: "asc" as const },
          },
        },
      },
      note: true,
      reviewPrompts: {
        where: {
          resolvedAt: null,
        },
        orderBy: {
          createdAt: "desc" as const,
        },
      },
    },
  },
};

function asRecordPayload(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function toManagerHistoryEntry(record: {
  id: string;
  type: string;
  actorRole: "guest" | "waiter" | "manager" | "system";
  actorId: string | null;
  tableId: number | null;
  tableSessionId: string | null;
  createdAt: Date;
  payload: Prisma.JsonValue | null;
}): ManagerHistoryEntry {
  return {
    id: record.id,
    type: record.type,
    actorRole: record.actorRole,
    actorId: record.actorId ?? undefined,
    tableId: record.tableId ?? undefined,
    tableSessionId: record.tableSessionId ?? undefined,
    ts: record.createdAt.getTime(),
    payload: asRecordPayload(record.payload),
  };
}

function defaultTablePosition(tableId: number) {
  const index = Math.max(0, tableId - 1);
  const row = Math.floor(index / 5);
  const col = index % 5;
  return {
    x: 12 + col * 20,
    y: 16 + row * 17,
  };
}

function resolveTableNode(
  table: {
    id: number;
    label: string | null;
    shape?: FloorTableShape;
    sizePreset?: FloorTableSizePreset;
    floorX?: number | null;
    floorY?: number | null;
    archivedAt?: Date | null;
  },
  fallback?: FloorTableNode,
): ManagerTableNode {
  const defaults = defaultTablePosition(table.id);
  return {
    tableId: table.id,
    label: table.label ?? fallback?.label ?? `Table ${table.id}`,
    zoneId: fallback?.zoneId,
    shape: table.shape ?? fallback?.shape ?? "square",
    sizePreset: table.sizePreset ?? fallback?.sizePreset ?? "md",
    x: table.floorX ?? fallback?.x ?? defaults.x,
    y: table.floorY ?? fallback?.y ?? defaults.y,
    archivedAt: table.archivedAt?.getTime() ?? undefined,
  };
}

function attachZoneFallback(table: ManagerTableNode, zones: FloorZone[]): ManagerTableNode {
  const fallbackZoneId = zones[0]?.id;
  return {
    ...table,
    zoneId: table.zoneId && zones.some((zone) => zone.id === table.zoneId) ? table.zoneId : fallbackZoneId,
  };
}

async function getTableRecordForManager(tableId: number): Promise<ManagerTableRecord> {
  const table = await prisma.restaurantTable.findUnique({
    where: { id: tableId },
    include: ACTIVE_TABLE_INCLUDE,
  });

  if (!table || table.archivedAt) {
    throw new ApiError(404, "Table not found");
  }

  return table as ManagerTableRecord;
}

async function getManagerWaiterProfiles(activeOnly: boolean): Promise<WaiterProfile[]> {
  const [waiters, assignmentsMap] = await Promise.all([
    prisma.staffUser.findMany({
      where: {
        role: "waiter",
        ...(activeOnly ? { active: true } : {}),
      },
      orderBy: { name: "asc" },
    }),
    getWaiterAssignmentsMap(),
  ]);

  return waiters.map((waiter) =>
    normalizeWaiter(waiter, (assignmentsMap.tableIdsByWaiter.get(waiter.id) ?? []).sort((a, b) => a - b)),
  );
}

function toManagerTableSummary(table: ManagerTableRecord, publicBaseUrl?: string): ManagerTableSummary {
  const session = getActiveSession(table);
  const total = session?.billLines.reduce((sum, line) => sum + line.qty * line.price, 0) ?? 0;
  const activeRequestsCount = session?.requests.filter((request) => !request.resolvedAt).length ?? 0;

  return {
    ...toHallTable(table),
    activeRequestsCount,
    total,
    guestLink: buildGuestTableLink(table.id, { publicBaseUrl }),
  };
}

function toManagerTableDetail(
  table: ManagerTableRecord,
  availableWaiters: WaiterProfile[],
  publicBaseUrl?: string,
): ManagerTableDetail {
  const session = getActiveSession(table);
  const billLines = session?.billLines.map(toBillLine) ?? [];
  const requests = session?.requests.filter((request) => !request.resolvedAt).map(toServiceRequest) ?? [];
  const reviewPrompt = toReviewPrompt(
    session?.reviewPrompts.find((prompt) => prompt.expiresAt.getTime() > Date.now()),
  );

  return {
    table: toHallTable(table),
    assignedWaiterId: getAssignedWaiterId(table),
    requests,
    billLines,
    total: billLines.reduce((sum, line) => sum + line.qty * line.price, 0),
    note: session?.note?.content ?? "",
    reviewPrompt,
    sessionId: session?.id,
    sessionStartedAt: session?.startedAt.getTime(),
    availableWaiters,
    guestLink: buildGuestTableLink(table.id, { publicBaseUrl }),
  };
}

function normalizeLogin(login: string) {
  return login.trim().toLowerCase();
}

async function assertWaiterLoginAvailable(login: string, waiterId?: string) {
  const existing = await prisma.staffUser.findUnique({
    where: { login: normalizeLogin(login) },
  });
  if (existing && existing.id !== waiterId) {
    throw new ApiError(409, "Login is already in use");
  }
}

async function ensureEditableActiveTables(tableIds: number[]) {
  const uniqueIds = Array.from(new Set(tableIds));
  if (uniqueIds.length === 0) return uniqueIds;

  const tables = await prisma.restaurantTable.findMany({
    where: {
      id: { in: uniqueIds },
      archivedAt: null,
    },
    select: { id: true },
  });

  if (tables.length !== uniqueIds.length) {
    throw new ApiError(404, "One or more tables are missing");
  }

  return uniqueIds.sort((a, b) => a - b);
}

async function replaceAssignments(waiterId: string, tableIds: number[], managerId?: string) {
  const desiredIds = await ensureEditableActiveTables(tableIds);
  const now = new Date();

  const currentAssignments = await prisma.tableAssignment.findMany({
    where: { endedAt: null },
    orderBy: [{ tableId: "asc" }, { createdAt: "desc" }],
  });

  const byTable = new Map<number, (typeof currentAssignments)[number]>();
  for (const assignment of currentAssignments) {
    if (!byTable.has(assignment.tableId)) {
      byTable.set(assignment.tableId, assignment);
    }
  }

  const currentTableIds = Array.from(byTable.values())
    .filter((assignment) => assignment.waiterId === waiterId)
    .map((assignment) => assignment.tableId);

  const currentSet = new Set(currentTableIds);
  const desiredSet = new Set(desiredIds);

  const toRemove = currentTableIds.filter((tableId) => !desiredSet.has(tableId));
  const toAssign = desiredIds.filter((tableId) => byTable.get(tableId)?.waiterId !== waiterId);

  if (toRemove.length > 0) {
    await prisma.tableAssignment.updateMany({
      where: {
        waiterId,
        tableId: { in: toRemove },
        endedAt: null,
      },
      data: { endedAt: now },
    });

    await prisma.waiterTask.updateMany({
      where: {
        waiterId,
        tableId: { in: toRemove },
        status: { in: ["open", "acknowledged", "in_progress"] },
      },
      data: {
        waiterId: null,
      },
    });
  }

  for (const tableId of toAssign) {
    const current = byTable.get(tableId);
    if (current && current.endedAt == null) {
      await prisma.tableAssignment.update({
        where: { id: current.id },
        data: { endedAt: now },
      });
    }

    await prisma.tableAssignment.create({
      data: {
        waiterId,
        tableId,
        createdAt: now,
      },
    });

    await prisma.waiterTask.updateMany({
      where: {
        tableId,
        status: { in: ["open", "acknowledged", "in_progress"] },
      },
      data: {
        waiterId,
      },
    });
  }

  const events = await appendActivityEvents([
    ...toRemove.map((tableId) => ({
      type: "table:assignment_changed",
      actorRole: "manager" as const,
      actorId: managerId,
      tableId,
      payload: {
        previousWaiterId: waiterId,
        nextWaiterId: undefined,
      },
    })),
    ...toAssign.map((tableId) => ({
      type: "table:assignment_changed",
      actorRole: "manager" as const,
      actorId: managerId,
      tableId,
      payload: {
        previousWaiterId: byTable.get(tableId)?.waiterId,
        nextWaiterId: waiterId,
      },
    })),
    ...toRemove.map((tableId) => ({
      type: "task:updated",
      actorRole: "manager" as const,
      actorId: managerId,
      tableId,
      payload: {
        waiterId: undefined,
        status: "open",
      },
    })),
    ...toAssign.map((tableId) => ({
      type: "task:updated",
      actorRole: "manager" as const,
      actorId: managerId,
      tableId,
      payload: {
        waiterId,
        status: "open",
      },
    })),
  ]);
  publishActivityEvents(events);

  if (currentSet.size === desiredSet.size && Array.from(currentSet).every((tableId) => desiredSet.has(tableId))) {
    return;
  }
}

async function buildManagerWaiterDetail(waiterId: string): Promise<ManagerWaiterDetail> {
  const [waiter, waiters, activeSessions, reviewMetricsByWaiter] = await Promise.all([
    prisma.staffUser.findFirst({
      where: { id: waiterId, role: "waiter" },
    }),
    getManagerWaiterProfiles(false),
    prisma.restaurantTable.findMany({
      where: {
        archivedAt: null,
        assignments: {
          some: {
            waiterId,
            endedAt: null,
          },
        },
        sessions: {
          some: {
            closedAt: null,
          },
        },
      },
      select: { id: true },
    }),
    getWaiterReviewMetricsMap([waiterId]),
  ]);

  if (!waiter) {
    throw new ApiError(404, "Waiter not found");
  }

  const reviewMetrics = reviewMetricsByWaiter.get(waiterId) ?? {
    avgRatingAllTime: 0,
    reviewsCountAllTime: 0,
    commentsCountAllTime: 0,
  };

  const profile = waiters.find((candidate) => candidate.id === waiterId);
  if (!profile) {
    return {
      id: waiter.id,
      name: waiter.name,
      login: waiter.login,
      active: waiter.active,
      tableIds: [],
      assignedTablesCount: 0,
      avgRatingAllTime: reviewMetrics.avgRatingAllTime,
      reviewsCountAllTime: reviewMetrics.reviewsCountAllTime,
      canDeactivate: true,
      activeSessionTableIds: activeSessions.map((item) => item.id).sort((a, b) => a - b),
    };
  }

  return {
    ...profile,
    assignedTablesCount: profile.tableIds.length,
    avgRatingAllTime: reviewMetrics.avgRatingAllTime,
    reviewsCountAllTime: reviewMetrics.reviewsCountAllTime,
    canDeactivate: profile.tableIds.length === 0,
    activeSessionTableIds: activeSessions.map((item) => item.id).sort((a, b) => a - b),
  };
}

function sanitizeDishInput(input: DishInput) {
  return {
    categoryId: input.categoryId.trim(),
    nameRu: input.nameRu.trim(),
    nameIt: input.nameIt.trim(),
    description: input.description.trim(),
    price: Math.max(0, Math.floor(Number(input.price ?? 0))),
    image: input.image.trim(),
    portion: input.portion.trim(),
    energyKcal: Math.max(0, Math.floor(Number(input.energyKcal ?? 0))),
    badgeLabel: input.badgeLabel?.trim() || undefined,
    badgeTone: input.badgeTone,
    highlight: !!input.highlight,
    available: input.available !== false,
  };
}

function sanitizeZones(zones: FloorZone[]) {
  return zones.map((zone) => ({
    id: zone.id,
    label: zone.label.trim(),
    x: Number(zone.x),
    y: Number(zone.y),
    width: Number(zone.width),
    height: Number(zone.height),
  }));
}

function sanitizeTableNodes(tables: UpdateLayoutInput["tables"], zones: FloorZone[]) {
  const fallbackZoneId = zones[0]?.id;
  return tables.map((table) => ({
    tableId: table.tableId,
    label: table.label?.trim() || null,
    zoneId:
      table.zoneId && zones.some((zone) => zone.id === table.zoneId)
        ? table.zoneId
        : fallbackZoneId,
    x: Number(table.x),
    y: Number(table.y),
    shape: table.shape,
    sizePreset: table.sizePreset,
  }));
}

async function getLayoutSettings() {
  return prisma.restaurantSettings.findUnique({
    where: { id: 1 },
  });
}

export async function getManagerHall(managerId: string, publicBaseUrl?: string): Promise<ManagerHallResponse> {
  const manager = await loadManagerProfile(managerId);
  const [waiters, tables] = await Promise.all([
    getManagerWaiterProfiles(true),
    prisma.restaurantTable.findMany({
      where: { archivedAt: null },
      orderBy: { id: "asc" },
      include: ACTIVE_TABLE_INCLUDE,
    }),
  ]);

  return {
    manager,
    waiters,
    tables: (tables as ManagerTableRecord[]).map((table) => toManagerTableSummary(table, publicBaseUrl)),
  };
}

export async function getManagerTableDetail(
  managerId: string,
  tableId: number,
  publicBaseUrl?: string,
): Promise<ManagerTableDetail> {
  await ensureManager(managerId);
  const [table, waiters] = await Promise.all([
    getTableRecordForManager(tableId),
    getManagerWaiterProfiles(true),
  ]);
  return toManagerTableDetail(table, waiters, publicBaseUrl);
}

export async function reassignManagerTable(input: {
  managerId: string;
  tableId: number;
  waiterId?: string;
  publicBaseUrl?: string;
}): Promise<ManagerTableDetail> {
  await ensureManager(input.managerId);
  if (input.waiterId) {
    await ensureWaiter(input.waiterId);
  }

  const table = await getTableRecordForManager(input.tableId);
  const currentWaiterId = getAssignedWaiterId(table);
  if (currentWaiterId === input.waiterId) {
    return getManagerTableDetail(input.managerId, input.tableId, input.publicBaseUrl);
  }

  const now = new Date();

  if (currentWaiterId) {
    await prisma.tableAssignment.updateMany({
      where: {
        tableId: input.tableId,
        endedAt: null,
      },
      data: { endedAt: now },
    });
  }

  await prisma.waiterTask.updateMany({
    where: {
      tableId: input.tableId,
      status: { in: ["open", "acknowledged", "in_progress"] },
    },
    data: {
      waiterId: input.waiterId ?? null,
    },
  });

  if (input.waiterId) {
    await prisma.tableAssignment.create({
      data: {
        tableId: input.tableId,
        waiterId: input.waiterId,
        createdAt: now,
      },
    });
  }

  const activeSessionId = table.sessions[0]?.id;
  const events = await appendActivityEvents([
    {
      type: "table:assignment_changed",
      actorRole: "manager",
      actorId: input.managerId,
      tableId: input.tableId,
      tableSessionId: activeSessionId,
      payload: {
        previousWaiterId: currentWaiterId,
        nextWaiterId: input.waiterId,
      },
    },
    {
      type: "task:updated",
      actorRole: "manager",
      actorId: input.managerId,
      tableId: input.tableId,
      tableSessionId: activeSessionId,
      payload: {
        waiterId: input.waiterId,
        status: "open",
      },
    },
  ]);
  publishActivityEvents(events);

  return getManagerTableDetail(input.managerId, input.tableId, input.publicBaseUrl);
}

export async function closeManagerTable(input: {
  managerId: string;
  tableId: number;
  publicBaseUrl?: string;
}): Promise<ManagerTableDetail> {
  await ensureManager(input.managerId);
  const table = await getTableRecordForManager(input.tableId);
  const session = getActiveSession(table);
  const assignedWaiterId = getAssignedWaiterId(table);
  if (!session) {
    throw new ApiError(409, "There is no active table session");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60_000);
  let reviewPromptId = "";

  await prisma.$transaction(async (tx) => {
    await tx.waiterTask.updateMany({
      where: {
        tableSessionId: session.id,
        status: { in: ["open", "acknowledged", "in_progress"] },
      },
      data: {
        status: "cancelled",
        cancelledAt: now,
      },
    });

    await tx.serviceRequest.updateMany({
      where: {
        tableSessionId: session.id,
        resolvedAt: null,
      },
      data: {
        resolvedAt: now,
      },
    });

    await tx.reviewPrompt.updateMany({
      where: {
        tableSessionId: session.id,
        resolvedAt: null,
      },
      data: {
        resolvedAt: now,
      },
    });

    const prompt = await tx.reviewPrompt.create({
      data: {
        tableSessionId: session.id,
        tableId: input.tableId,
        waiterId: assignedWaiterId,
        createdAt: now,
        expiresAt,
      },
    });
    reviewPromptId = prompt.id;

    await tx.tableSession.update({
      where: { id: session.id },
      data: {
        closedAt: now,
      },
    });
  });

  const events = await appendActivityEvents([
    {
      type: "waiter:done",
      actorRole: "manager",
      actorId: input.managerId,
      tableId: input.tableId,
      tableSessionId: session.id,
      payload: {
        expiresAt: expiresAt.getTime(),
        reviewPromptId,
        action: "closed_by_manager",
      },
    },
    {
      type: "table:status_changed",
      actorRole: "manager",
      actorId: input.managerId,
      tableId: input.tableId,
      tableSessionId: session.id,
      payload: {
        to: "free",
        action: "closed_by_manager",
      },
    },
    {
      type: "task:updated",
      actorRole: "manager",
      actorId: input.managerId,
      tableId: input.tableId,
      tableSessionId: session.id,
      payload: {
        status: "cancelled",
      },
    },
  ]);
  publishActivityEvents(events);

  return getManagerTableDetail(input.managerId, input.tableId, input.publicBaseUrl);
}

export async function getManagerHistory(input: {
  managerId: string;
  tableId?: number;
  waiterId?: string;
  type?: string;
  cursor?: string;
  limit?: number;
}): Promise<ManagerHistoryPage> {
  await ensureManager(input.managerId);

  const limit = Math.max(1, Math.min(50, Math.floor(Number(input.limit ?? 25))));
  const cursor = parseHistoryCursor(input.cursor);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const items = await prisma.serviceActivityEvent.findMany({
    where: {
      createdAt: { gte: since },
      ...(input.tableId ? { tableId: input.tableId } : {}),
      ...(input.waiterId ? { actorId: input.waiterId } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.ts) } },
              {
                createdAt: new Date(cursor.ts),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const page = items.slice(0, limit).map(toManagerHistoryEntry);
  const next = items.length > limit ? items[limit - 1] : null;

  return {
    items: page,
    nextCursor: next
      ? serializeHistoryCursor({
          ts: next.createdAt.getTime(),
          id: next.id,
        })
      : undefined,
  };
}

export async function listManagerWaiters(managerId: string): Promise<ManagerWaiterSummary[]> {
  await ensureManager(managerId);
  const waiters = await getManagerWaiterProfiles(false);
  const reviewMetricsByWaiter = await getWaiterReviewMetricsMap(waiters.map((waiter) => waiter.id));

  return waiters.map((waiter) => ({
    ...waiter,
    assignedTablesCount: waiter.tableIds.length,
    avgRatingAllTime: reviewMetricsByWaiter.get(waiter.id)?.avgRatingAllTime ?? 0,
    reviewsCountAllTime: reviewMetricsByWaiter.get(waiter.id)?.reviewsCountAllTime ?? 0,
  }));
}

export async function getManagerWaiterDetail(managerId: string, waiterId: string): Promise<ManagerWaiterDetail> {
  await ensureManager(managerId);
  return buildManagerWaiterDetail(waiterId);
}

export async function getManagerReviews(input: {
  managerId: string;
  waiterId?: string;
  cursor?: string;
  limit?: number;
}): Promise<ReviewHistoryPage> {
  await ensureManager(input.managerId);

  const waiterId = input.waiterId?.trim();
  if (waiterId) {
    const waiter = await prisma.staffUser.findFirst({
      where: {
        id: waiterId,
        role: "waiter",
      },
      select: { id: true },
    });
    if (!waiter) {
      throw new ApiError(404, "Waiter not found");
    }
  }

  return getReviewHistoryPage({
    waiterId,
    cursor: input.cursor,
    limit: input.limit,
  });
}

export async function createManagerWaiter(input: {
  managerId: string;
  payload: CreateWaiterInput;
}): Promise<ManagerWaiterDetail> {
  await ensureManager(input.managerId);

  const name = input.payload.name.trim();
  const login = normalizeLogin(input.payload.login);
  const password = input.payload.password.trim();
  if (!name || !login || !password) {
    throw new ApiError(400, "Name, login, and password are required");
  }

  await assertWaiterLoginAvailable(login);
  const passwordHash = await hashPassword(password);

  const waiter = await prisma.staffUser.create({
    data: {
      id: `waiter-${randomUUID()}`,
      role: "waiter",
      name,
      login,
      passwordHash,
      active: true,
    },
  });

  if (input.payload.tableIds.length > 0) {
    await replaceAssignments(waiter.id, input.payload.tableIds, input.managerId);
  }

  const events = await appendActivityEvents([
    {
      type: "waiter:created",
      actorRole: "manager",
      actorId: input.managerId,
      payload: {
        waiterId: waiter.id,
        login: waiter.login,
        name: waiter.name,
      },
    },
  ]);
  publishActivityEvents(events);

  return buildManagerWaiterDetail(waiter.id);
}

export async function updateManagerWaiter(input: {
  managerId: string;
  waiterId: string;
  payload: UpdateWaiterInput;
}): Promise<ManagerWaiterDetail> {
  await ensureManager(input.managerId);
  const waiter = await prisma.staffUser.findFirst({
    where: {
      id: input.waiterId,
      role: "waiter",
    },
  });
  if (!waiter) {
    throw new ApiError(404, "Waiter not found");
  }

  if (input.payload.login) {
    await assertWaiterLoginAvailable(input.payload.login, waiter.id);
  }

  const existingDetail = await buildManagerWaiterDetail(waiter.id);
  if (input.payload.active === false && !existingDetail.canDeactivate) {
    throw new ApiError(409, "Reassign waiter tables before deactivation");
  }

  await prisma.staffUser.update({
    where: { id: waiter.id },
    data: {
      ...(input.payload.name !== undefined ? { name: input.payload.name.trim() } : {}),
      ...(input.payload.login !== undefined ? { login: normalizeLogin(input.payload.login) } : {}),
      ...(input.payload.active !== undefined ? { active: input.payload.active } : {}),
    },
  });

  const events = await appendActivityEvents([
    {
      type: input.payload.active === false ? "waiter:deactivated" : "waiter:updated",
      actorRole: "manager",
      actorId: input.managerId,
      payload: {
        waiterId: waiter.id,
      },
    },
  ]);
  publishActivityEvents(events);

  return buildManagerWaiterDetail(waiter.id);
}

export async function resetManagerWaiterPassword(input: {
  managerId: string;
  waiterId: string;
  payload: ResetWaiterPasswordInput;
}): Promise<ManagerWaiterDetail> {
  await ensureManager(input.managerId);
  const waiter = await prisma.staffUser.findFirst({
    where: { id: input.waiterId, role: "waiter" },
  });
  if (!waiter) {
    throw new ApiError(404, "Waiter not found");
  }

  const password = input.payload.password.trim();
  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  await prisma.staffUser.update({
    where: { id: waiter.id },
    data: {
      passwordHash: await hashPassword(password),
    },
  });

  const events = await appendActivityEvents([
    {
      type: "waiter:password_reset",
      actorRole: "manager",
      actorId: input.managerId,
      payload: {
        waiterId: waiter.id,
      },
    },
  ]);
  publishActivityEvents(events);

  return buildManagerWaiterDetail(waiter.id);
}

export async function replaceManagerWaiterAssignments(input: {
  managerId: string;
  waiterId: string;
  payload: ReplaceWaiterAssignmentsInput;
}): Promise<ManagerWaiterDetail> {
  await ensureManager(input.managerId);
  const waiter = await prisma.staffUser.findFirst({
    where: { id: input.waiterId, role: "waiter" },
  });
  if (!waiter) {
    throw new ApiError(404, "Waiter not found");
  }
  if (!waiter.active) {
    throw new ApiError(409, "Cannot assign tables to an inactive waiter");
  }

  await replaceAssignments(waiter.id, input.payload.tableIds, input.managerId);
  return buildManagerWaiterDetail(waiter.id);
}

export async function getManagerMenuSnapshot(managerId: string): Promise<ManagerMenuSnapshot> {
  await ensureManager(managerId);
  const restaurant = await getRestaurantData();
  return {
    categories: restaurant.categories,
    dishes: restaurant.dishes,
  };
}

export async function getManagerRestaurantSettings(managerId: string) {
  await ensureManager(managerId);
  return getRestaurantData();
}

export async function updateManagerRestaurantSettings(input: {
  managerId: string;
  payload: RestaurantProfileInput;
}) {
  await ensureManager(input.managerId);
  const restaurant = await updateRestaurantProfile(input.payload);

  const events = await appendActivityEvents([
    {
      type: "restaurant:updated",
      actorRole: "manager",
      actorId: input.managerId,
      payload: { action: "restaurant_profile_updated" },
    },
  ]);
  publishActivityEvents(events);

  return restaurant;
}

export async function createManagerMenuCategory(input: {
  managerId: string;
  payload: MenuCategoryInput;
}): Promise<ManagerMenuSnapshot> {
  await ensureManager(input.managerId);
  const labelRu = input.payload.labelRu.trim();
  if (!labelRu) {
    throw new ApiError(400, "Category label is required");
  }

  const maxOrder = await prisma.menuCategory.aggregate({
    _max: { sortOrder: true },
  });

  await prisma.menuCategory.create({
    data: {
      id: `cat-${randomUUID()}`,
      labelRu,
      icon: input.payload.icon?.trim() || null,
      sortOrder: input.payload.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  const events = await appendActivityEvents([
    {
      type: "menu:changed",
      actorRole: "manager",
      actorId: input.managerId,
      payload: { action: "category_created", labelRu },
    },
  ]);
  publishActivityEvents(events);

  return getManagerMenuSnapshot(input.managerId);
}

export async function updateManagerMenuCategory(input: {
  managerId: string;
  categoryId: string;
  payload: MenuCategoryInput;
}): Promise<ManagerMenuSnapshot> {
  await ensureManager(input.managerId);
  await prisma.menuCategory.update({
    where: { id: input.categoryId },
    data: {
      labelRu: input.payload.labelRu.trim(),
      icon: input.payload.icon?.trim() || null,
      ...(input.payload.sortOrder !== undefined ? { sortOrder: input.payload.sortOrder } : {}),
    },
  });

  const events = await appendActivityEvents([
    {
      type: "menu:changed",
      actorRole: "manager",
      actorId: input.managerId,
      payload: { action: "category_updated", categoryId: input.categoryId },
    },
  ]);
  publishActivityEvents(events);

  return getManagerMenuSnapshot(input.managerId);
}

export async function deleteManagerMenuCategory(input: {
  managerId: string;
  categoryId: string;
}): Promise<ManagerMenuSnapshot> {
  await ensureManager(input.managerId);
  const dishCount = await prisma.dish.count({
    where: { categoryId: input.categoryId },
  });
  if (dishCount > 0) {
    throw new ApiError(409, "Cannot delete a category that still has dishes");
  }

  await prisma.menuCategory.delete({
    where: { id: input.categoryId },
  });

  const events = await appendActivityEvents([
    {
      type: "menu:changed",
      actorRole: "manager",
      actorId: input.managerId,
      payload: { action: "category_deleted", categoryId: input.categoryId },
    },
  ]);
  publishActivityEvents(events);

  return getManagerMenuSnapshot(input.managerId);
}

export async function createManagerDish(input: {
  managerId: string;
  payload: DishInput;
}): Promise<ManagerMenuSnapshot> {
  await ensureManager(input.managerId);
  const dish = sanitizeDishInput(input.payload);
  if (!dish.categoryId || !dish.nameRu || !dish.nameIt || !dish.image || !dish.portion) {
    throw new ApiError(400, "Dish fields are incomplete");
  }

  const maxOrder = await prisma.dish.aggregate({
    where: { categoryId: dish.categoryId },
    _max: { sortOrder: true },
  });

  await prisma.dish.create({
    data: {
      id: `dish-${randomUUID()}`,
      categoryId: dish.categoryId,
      nameRu: dish.nameRu,
      nameIt: dish.nameIt,
      description: dish.description,
      price: dish.price,
      image: dish.image,
      portion: dish.portion,
      energyKcal: dish.energyKcal,
      badgeLabel: dish.badgeLabel,
      badgeTone: dish.badgeTone,
      highlight: dish.highlight,
      available: dish.available,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  const events = await appendActivityEvents([
    {
      type: "menu:changed",
      actorRole: "manager",
      actorId: input.managerId,
      payload: { action: "dish_created", categoryId: dish.categoryId, nameRu: dish.nameRu },
    },
  ]);
  publishActivityEvents(events);

  return getManagerMenuSnapshot(input.managerId);
}

export async function updateManagerDish(input: {
  managerId: string;
  dishId: string;
  payload: DishInput;
}): Promise<ManagerMenuSnapshot> {
  await ensureManager(input.managerId);
  const dish = sanitizeDishInput(input.payload);
  await prisma.dish.update({
    where: { id: input.dishId },
    data: {
      categoryId: dish.categoryId,
      nameRu: dish.nameRu,
      nameIt: dish.nameIt,
      description: dish.description,
      price: dish.price,
      image: dish.image,
      portion: dish.portion,
      energyKcal: dish.energyKcal,
      badgeLabel: dish.badgeLabel,
      badgeTone: dish.badgeTone,
      highlight: dish.highlight,
      available: dish.available,
    },
  });

  const events = await appendActivityEvents([
    {
      type: "menu:changed",
      actorRole: "manager",
      actorId: input.managerId,
      payload: { action: "dish_updated", dishId: input.dishId },
    },
  ]);
  publishActivityEvents(events);

  return getManagerMenuSnapshot(input.managerId);
}

export async function deleteManagerDish(input: {
  managerId: string;
  dishId: string;
}): Promise<ManagerMenuSnapshot> {
  await ensureManager(input.managerId);
  await prisma.dish.delete({
    where: { id: input.dishId },
  });

  const events = await appendActivityEvents([
    {
      type: "menu:changed",
      actorRole: "manager",
      actorId: input.managerId,
      payload: { action: "dish_deleted", dishId: input.dishId },
    },
  ]);
  publishActivityEvents(events);

  return getManagerMenuSnapshot(input.managerId);
}

export async function toggleManagerDishAvailability(input: {
  managerId: string;
  dishId: string;
}): Promise<ManagerMenuSnapshot> {
  await ensureManager(input.managerId);
  const dish = await prisma.dish.findUnique({
    where: { id: input.dishId },
  });
  if (!dish) {
    throw new ApiError(404, "Dish not found");
  }

  await prisma.dish.update({
    where: { id: input.dishId },
    data: { available: !dish.available },
  });

  const events = await appendActivityEvents([
    {
      type: "menu:changed",
      actorRole: "manager",
      actorId: input.managerId,
      payload: {
        action: "dish_availability_toggled",
        dishId: input.dishId,
        available: !dish.available,
      },
    },
  ]);
  publishActivityEvents(events);

  return getManagerMenuSnapshot(input.managerId);
}

export async function reorderManagerMenu(input: {
  managerId: string;
  categoryIds?: string[];
  dishIdsByCategory?: Record<string, string[]>;
}): Promise<ManagerMenuSnapshot> {
  await ensureManager(input.managerId);

  await prisma.$transaction(async (tx) => {
    if (input.categoryIds?.length) {
      for (let index = 0; index < input.categoryIds.length; index += 1) {
        const categoryId = input.categoryIds[index];
        await tx.menuCategory.update({
          where: { id: categoryId },
          data: { sortOrder: index },
        });
      }
    }

    const groups = Object.entries(input.dishIdsByCategory ?? {});
    for (const [categoryId, dishIds] of groups) {
      for (let index = 0; index < dishIds.length; index += 1) {
        const dishId = dishIds[index];
        await tx.dish.update({
          where: { id: dishId },
          data: {
            categoryId,
            sortOrder: index,
          },
        });
      }
    }
  });

  const events = await appendActivityEvents([
    {
      type: "menu:changed",
      actorRole: "manager",
      actorId: input.managerId,
      payload: { action: "menu_reordered" },
    },
  ]);
  publishActivityEvents(events);

  return getManagerMenuSnapshot(input.managerId);
}

export async function getManagerLayout(managerId: string): Promise<ManagerLayoutSnapshot> {
  await ensureManager(managerId);

  const [tables, settings] = await Promise.all([
    prisma.restaurantTable.findMany({
      orderBy: { id: "asc" },
        select: {
          id: true,
          label: true,
          shape: true,
          sizePreset: true,
          floorX: true,
          floorY: true,
          archivedAt: true,
      },
    }),
    getLayoutSettings(),
  ]);

  const stored = asFloorPlan(settings?.floorPlan);
  const fallbackByTableId = new Map(stored.tables.map((table) => [table.tableId, table]));

  const activeTables: ManagerTableNode[] = [];
  const archivedTables: ManagerTableNode[] = [];

  for (const table of tables) {
    const node = attachZoneFallback(resolveTableNode(table, fallbackByTableId.get(table.id)), stored.zones);
    if (table.archivedAt) {
      archivedTables.push(node);
    } else {
      activeTables.push(node);
    }
  }

  return {
    activeTables,
    archivedTables,
    zones: stored.zones,
  };
}

export async function updateManagerLayout(input: {
  managerId: string;
  payload: UpdateLayoutInput;
}): Promise<ManagerLayoutSnapshot> {
  await ensureManager(input.managerId);

  const zones = sanitizeZones(input.payload.zones);
  const tables = sanitizeTableNodes(input.payload.tables, zones);

  await prisma.$transaction(async (tx) => {
    for (const table of tables) {
      await tx.restaurantTable.update({
        where: { id: table.tableId },
        data: {
          label: table.label,
          floorX: table.x,
          floorY: table.y,
          shape: table.shape,
          sizePreset: table.sizePreset,
        },
      });
    }

    await tx.restaurantSettings.upsert({
      where: { id: 1 },
      update: {
        floorPlan: {
          tables: tables.map((table) => ({
            tableId: table.tableId,
            label: table.label ?? undefined,
            zoneId: table.zoneId,
            x: table.x,
            y: table.y,
            shape: table.shape,
            sizePreset: table.sizePreset,
          })),
          zones,
        },
      },
      create: {
        id: 1,
        managerSoundEnabled: true,
        floorPlan: {
          tables: tables.map((table) => ({
            tableId: table.tableId,
            label: table.label ?? undefined,
            zoneId: table.zoneId,
            x: table.x,
            y: table.y,
            shape: table.shape,
            sizePreset: table.sizePreset,
          })),
          zones,
        },
      },
    });
  });

  const events = await appendActivityEvents([
    {
      type: "floor:layout_changed",
      actorRole: "manager",
      actorId: input.managerId,
      payload: { tableIds: tables.map((table) => table.tableId) },
    },
  ]);
  publishActivityEvents(events);

  return getManagerLayout(input.managerId);
}

export async function createManagerTable(input: {
  managerId: string;
  payload?: Partial<ManagerTableNode>;
}): Promise<ManagerLayoutSnapshot> {
  await ensureManager(input.managerId);
  const latest = await prisma.restaurantTable.aggregate({
    _max: { id: true },
  });
  const tableId = (latest._max.id ?? 0) + 1;
  const defaults = defaultTablePosition(tableId);

  await prisma.restaurantTable.create({
    data: {
      id: tableId,
      label: input.payload?.label?.trim() || `Table ${tableId}`,
      shape: input.payload?.shape ?? "square",
      sizePreset: input.payload?.sizePreset ?? "md",
      floorX: input.payload?.x ?? defaults.x,
      floorY: input.payload?.y ?? defaults.y,
    },
  });

  const settings = await getLayoutSettings();
  const stored = asFloorPlan(settings?.floorPlan);
  const fallbackZoneId = stored.zones[0]?.id;
  const zoneId =
    input.payload?.zoneId && stored.zones.some((zone) => zone.id === input.payload?.zoneId)
      ? input.payload.zoneId
      : fallbackZoneId;

  await prisma.restaurantSettings.upsert({
    where: { id: 1 },
    update: {
      floorPlan: {
        tables: [
          ...stored.tables.filter((table) => table.tableId !== tableId),
          {
            tableId,
            label: input.payload?.label?.trim() || `Table ${tableId}`,
            zoneId,
            x: input.payload?.x ?? defaults.x,
            y: input.payload?.y ?? defaults.y,
            shape: input.payload?.shape ?? "square",
            sizePreset: input.payload?.sizePreset ?? "md",
          },
        ],
        zones: stored.zones,
      },
    },
    create: {
      id: 1,
      managerSoundEnabled: true,
      floorPlan: {
        tables: [
          {
            tableId,
            label: input.payload?.label?.trim() || `Table ${tableId}`,
            zoneId,
            x: input.payload?.x ?? defaults.x,
            y: input.payload?.y ?? defaults.y,
            shape: input.payload?.shape ?? "square",
            sizePreset: input.payload?.sizePreset ?? "md",
          },
        ],
        zones: stored.zones,
      },
    },
  });

  const events = await appendActivityEvents([
    {
      type: "table:created",
      actorRole: "manager",
      actorId: input.managerId,
      tableId,
      payload: { tableId },
    },
  ]);
  publishActivityEvents(events);

  return getManagerLayout(input.managerId);
}

export async function archiveManagerTable(input: {
  managerId: string;
  tableId: number;
}): Promise<ManagerLayoutSnapshot> {
  await ensureManager(input.managerId);

  const table = await prisma.restaurantTable.findUnique({
    where: { id: input.tableId },
    include: {
      assignments: {
        where: { endedAt: null },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      sessions: {
        where: { closedAt: null },
        take: 1,
      },
    },
  });

  if (!table || table.archivedAt) {
    throw new ApiError(404, "Table not found");
  }
  if (table.sessions.length > 0) {
    throw new ApiError(409, "Cannot archive a table with an active session");
  }

  const unresolvedRequests = await prisma.serviceRequest.count({
    where: {
      tableId: input.tableId,
      resolvedAt: null,
    },
  });
  if (unresolvedRequests > 0) {
    throw new ApiError(409, "Resolve requests before archiving the table");
  }

  const now = new Date();
  if (table.assignments[0]) {
    await prisma.tableAssignment.update({
      where: { id: table.assignments[0].id },
      data: { endedAt: now },
    });
  }

  await prisma.waiterTask.updateMany({
    where: {
      tableId: input.tableId,
      status: { in: ["open", "acknowledged", "in_progress"] },
    },
    data: {
      waiterId: null,
      status: "cancelled",
      cancelledAt: now,
    },
  });

  await prisma.restaurantTable.update({
    where: { id: input.tableId },
    data: { archivedAt: now },
  });

  const events = await appendActivityEvents([
    {
      type: "table:archived",
      actorRole: "manager",
      actorId: input.managerId,
      tableId: input.tableId,
      payload: {
        previousWaiterId: table.assignments[0]?.waiterId,
      },
    },
    ...(table.assignments[0]
      ? [
          {
            type: "table:assignment_changed",
            actorRole: "manager" as const,
            actorId: input.managerId,
            tableId: input.tableId,
            payload: {
              previousWaiterId: table.assignments[0]?.waiterId,
              nextWaiterId: undefined,
            },
          },
        ]
      : []),
    {
      type: "task:updated",
      actorRole: "manager",
      actorId: input.managerId,
      tableId: input.tableId,
      payload: {
        waiterId: undefined,
        status: "cancelled",
      },
    },
  ]);
  publishActivityEvents(events);

  return getManagerLayout(input.managerId);
}

export async function restoreManagerTable(input: {
  managerId: string;
  tableId: number;
}): Promise<ManagerLayoutSnapshot> {
  await ensureManager(input.managerId);
  const table = await prisma.restaurantTable.findUnique({
    where: { id: input.tableId },
  });

  if (!table) {
    throw new ApiError(404, "Table not found");
  }

  await prisma.restaurantTable.update({
    where: { id: input.tableId },
    data: { archivedAt: null },
  });

  const events = await appendActivityEvents([
    {
      type: "table:restored",
      actorRole: "manager",
      actorId: input.managerId,
      tableId: input.tableId,
      payload: { tableId: input.tableId },
    },
  ]);
  publishActivityEvents(events);

  return getManagerLayout(input.managerId);
}
