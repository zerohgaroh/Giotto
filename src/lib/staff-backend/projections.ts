import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ensureStaffBackendReady } from "./seed";
import type {
  BillLine,
  CooldownState,
  FloorTableNode,
  FloorTableShape,
  FloorTableSizePreset,
  FloorZone,
  HallData,
  HallTable,
  ManagerProfile,
  Review,
  ReviewPrompt,
  ServiceRequest,
  ServiceRequestType,
  ServiceTableStatus,
  WaiterTask,
  WaiterProfile,
  WaiterTableDetail,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ActiveSessionRecord = Prisma.TableSessionGetPayload<{
  include: {
    requests: true;
    billLines: true;
    waiterTasks: {
      orderBy: {
        createdAt: "desc";
      };
    };
    waiterOrderBatches: {
      orderBy: {
        createdAt: "desc";
      };
      include: {
        billLines: true;
      };
    };
    note: true;
    reviewPrompts: {
      where: {
        resolvedAt: null;
      };
      orderBy: {
        createdAt: "desc";
      };
    };
  };
}>;

export type TableRecord = Prisma.RestaurantTableGetPayload<{
  include: {
    assignments: {
      where: {
        endedAt: null;
      };
      orderBy: {
        createdAt: "desc";
      };
      take: 1;
      include: {
        waiter: true;
      };
    };
    sessions: {
      where: {
        closedAt: null;
      };
      orderBy: {
        startedAt: "desc";
      };
      take: 1;
      include: {
        requests: {
          orderBy: {
            createdAt: "desc";
          };
        };
        billLines: {
          orderBy: {
            createdAt: "asc";
          };
        };
        waiterTasks: {
          orderBy: {
            createdAt: "desc";
          };
        };
        waiterOrderBatches: {
          orderBy: {
            createdAt: "desc";
          };
          include: {
            billLines: true;
          };
        };
        note: true;
        reviewPrompts: {
          where: {
            resolvedAt: null;
          };
          orderBy: {
            createdAt: "desc";
          };
        };
      };
    };
  };
}>;

export function getAssignedWaiterId(table: TableRecord) {
  return table.assignments[0]?.waiterId;
}

export function getActiveSession(table: TableRecord) {
  return table.sessions[0] ?? null;
}

export function toUnixMs(value: Date | null | undefined) {
  return value ? value.getTime() : undefined;
}

export function remainingSeconds(availableAt: number, now: number) {
  if (availableAt <= now) return 0;
  return Math.max(1, Math.ceil((availableAt - now) / 1000));
}

export function toCooldownState(type: ServiceRequestType, availableAt: number, now: number): CooldownState {
  return {
    type,
    availableAt,
    remainingSec: remainingSeconds(availableAt, now),
  };
}

export function toServiceRequest(record: ActiveSessionRecord["requests"][number]): ServiceRequest {
  return {
    id: record.id,
    tableId: record.tableId,
    type: record.type,
    reason: record.reason,
    createdAt: record.createdAt.getTime(),
    acknowledgedAt: toUnixMs(record.acknowledgedAt),
    acknowledgedBy: record.acknowledgedById ?? undefined,
    resolvedAt: toUnixMs(record.resolvedAt),
  };
}

export function toBillLine(record: ActiveSessionRecord["billLines"][number]): BillLine {
  return {
    id: record.id,
    tableId: record.tableId,
    dishId: record.dishId ?? undefined,
    title: record.title,
    qty: record.qty,
    price: record.price,
    source: record.source,
    note: record.note ?? undefined,
    createdAt: record.createdAt.getTime(),
  };
}

export function toReviewPrompt(record: ActiveSessionRecord["reviewPrompts"][number] | null | undefined): ReviewPrompt | undefined {
  if (!record) return undefined;
  return {
    id: record.id,
    tableId: record.tableId,
    waiterId: record.waiterId ?? undefined,
    createdAt: record.createdAt.getTime(),
    expiresAt: record.expiresAt.getTime(),
  };
}

export function toWaiterTask(record: ActiveSessionRecord["waiterTasks"][number]): WaiterTask {
  return {
    id: record.id,
    tableId: record.tableId,
    tableSessionId: record.tableSessionId,
    waiterId: record.waiterId ?? undefined,
    type: record.type,
    priority: record.priority,
    status: record.status,
    sourceRequestId: record.sourceRequestId ?? undefined,
    title: record.title,
    subtitle: record.subtitle ?? undefined,
    note: record.note ?? undefined,
    createdAt: record.createdAt.getTime(),
    acknowledgedAt: toUnixMs(record.acknowledgedAt),
    startedAt: toUnixMs(record.startedAt),
    completedAt: toUnixMs(record.completedAt),
    dueAt: toUnixMs(record.dueAt),
  };
}

export function computeStatus(session: ActiveSessionRecord | null): ServiceTableStatus {
  if (!session) return "free";

  const unresolved = session.requests.filter((request) => !request.resolvedAt);
  if (unresolved.some((request) => request.type === "bill")) return "bill";
  if (unresolved.some((request) => request.type === "waiter")) return "waiting";
  if (session.billLines.length > 0) return "ordered";
  return "occupied";
}

export function toHallTable(table: TableRecord): HallTable {
  const session = getActiveSession(table);
  return {
    tableId: table.id,
    status: computeStatus(session),
    assignedWaiterId: getAssignedWaiterId(table),
    guestStartedAt: session?.startedAt.getTime() ?? Date.now(),
    hasActiveSession: !!session,
    doneCooldownUntil: toUnixMs(session?.doneCooldownUntil),
  };
}

export function normalizeWaiter(
  waiter: { id: string; name: string; login: string; active: boolean },
  tableIds: number[],
): WaiterProfile {
  return {
    id: waiter.id,
    name: waiter.name,
    login: waiter.login,
    active: waiter.active,
    tableIds,
  };
}

export function normalizeManager(manager: {
  id: string;
  name: string;
  login: string;
  active: boolean;
}): ManagerProfile {
  return {
    id: manager.id,
    name: manager.name,
    login: manager.login,
    active: manager.active,
  };
}

export function asFloorPlan(value: Prisma.JsonValue | null | undefined): {
  tables: FloorTableNode[];
  zones: FloorZone[];
} {
  const fallback = {
    tables: Array.from({ length: 20 }, (_, index) => {
      const tableId = index + 1;
      const row = Math.floor(index / 5);
      const col = index % 5;
      return {
        tableId,
        label: `Стол ${tableId}`,
        zoneId: tableId <= 15 ? "zone-main" : "zone-terrace",
        x: 12 + col * 20,
        y: 16 + row * 17,
        shape: (col % 3 === 0 ? "round" : col % 2 === 0 ? "rect" : "square") as FloorTableShape,
        sizePreset: "md" as FloorTableSizePreset,
      };
    }),
    zones: [
      { id: "zone-main", label: "Основной зал", x: 8, y: 8, width: 62, height: 56 },
      { id: "zone-terrace", label: "Терраса", x: 72, y: 12, width: 22, height: 36 },
    ],
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const raw = value as {
    tables: Array<{
      tableId?: number;
      label?: string;
      zoneId?: string;
      x?: number;
      y?: number;
      shape?: FloorTableShape | string;
      sizePreset?: FloorTableSizePreset | string;
    }>;
    zones: Array<{
      id?: string;
      label?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }>;
  };
  if (!Array.isArray(raw.tables) || !Array.isArray(raw.zones)) return fallback;
  return {
    tables: raw.tables.map((table) => ({
      tableId: Number(table.tableId),
      label: typeof table.label === "string" ? table.label : undefined,
      zoneId: typeof table.zoneId === "string" ? table.zoneId : undefined,
      x: Number(table.x ?? 0),
      y: Number(table.y ?? 0),
      shape: (table.shape === "round" || table.shape === "rect" ? table.shape : "square") as FloorTableShape,
      sizePreset:
        table.sizePreset === "sm" || table.sizePreset === "lg" || table.sizePreset === "md"
          ? table.sizePreset
          : "md",
    })),
    zones: raw.zones.map((zone) => ({
      id: String(zone.id ?? ""),
      label: String(zone.label ?? ""),
      x: Number(zone.x ?? 0),
      y: Number(zone.y ?? 0),
      width: Number(zone.width ?? 0),
      height: Number(zone.height ?? 0),
    })),
  };
}

export async function getWaiterAssignmentsMap() {
  await ensureStaffBackendReady();

  const assignments = await prisma.tableAssignment.findMany({
    where: { endedAt: null },
    orderBy: [{ tableId: "asc" }, { createdAt: "desc" }],
  });

  const waiterByTable = new Map<number, string>();
  const tableIdsByWaiter = new Map<string, number[]>();

  for (const assignment of assignments) {
    if (waiterByTable.has(assignment.tableId)) continue;
    waiterByTable.set(assignment.tableId, assignment.waiterId);
    const list = tableIdsByWaiter.get(assignment.waiterId) ?? [];
    list.push(assignment.tableId);
    tableIdsByWaiter.set(assignment.waiterId, list);
  }

  return { waiterByTable, tableIdsByWaiter };
}

export async function ensureWaiter(waiterId: string) {
  await ensureStaffBackendReady();
  const waiter = await prisma.staffUser.findFirst({
    where: {
      id: waiterId,
      role: "waiter",
      active: true,
    },
  });

  if (!waiter) {
    throw new ApiError(401, "Необходима авторизация официанта");
  }

  return waiter;
}

export async function ensureManager(managerId: string) {
  await ensureStaffBackendReady();
  const manager = await prisma.staffUser.findFirst({
    where: {
      id: managerId,
      role: "manager",
      active: true,
    },
  });

  if (!manager) {
    throw new ApiError(401, "Необходима авторизация менеджера");
  }

  return manager;
}

export async function loadWaiterProfile(waiterId: string) {
  const waiter = await ensureWaiter(waiterId);
  const { tableIdsByWaiter } = await getWaiterAssignmentsMap();
  return normalizeWaiter(waiter, (tableIdsByWaiter.get(waiter.id) ?? []).sort((a, b) => a - b));
}

export async function loadManagerProfile(managerId: string) {
  const manager = await ensureManager(managerId);
  return normalizeManager(manager);
}

export async function getAssignedTableRecord(tableId: number, waiterId: string) {
  await ensureStaffBackendReady();

  const table = await prisma.restaurantTable.findUnique({
    where: { id: tableId },
    include: {
      assignments: {
        where: { endedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { waiter: true },
      },
      sessions: {
        where: { closedAt: null },
        orderBy: { startedAt: "desc" },
        take: 1,
        include: {
          requests: {
            orderBy: { createdAt: "desc" },
          },
          billLines: {
            orderBy: { createdAt: "asc" },
          },
          waiterTasks: {
            orderBy: { createdAt: "desc" },
          },
          waiterOrderBatches: {
            orderBy: { createdAt: "desc" },
            include: { billLines: true },
          },
          note: true,
          reviewPrompts: {
            where: {
              resolvedAt: null,
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!table) {
    throw new ApiError(404, "Стол не найден");
  }

  if (getAssignedWaiterId(table) !== waiterId) {
    throw new ApiError(403, "Стол не назначен этому официанту");
  }

  return table;
}

export async function ensureActiveSession(
  tableId: number,
  tx: Prisma.TransactionClient,
  startedAt: Date = new Date(),
) {
  const active = await tx.tableSession.findFirst({
    where: {
      tableId,
      closedAt: null,
    },
    orderBy: { startedAt: "desc" },
  });

  if (active) return active;

  return tx.tableSession.create({
    data: {
      tableId,
      startedAt,
    },
  });
}

export function toWaiterTableDetail(waiter: WaiterProfile, table: TableRecord): WaiterTableDetail {
  const hallTable = toHallTable(table);
  const session = getActiveSession(table);
  const requests = session?.requests
    .filter((request) => !request.resolvedAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toServiceRequest) ?? [];
  const billLines = session?.billLines.map(toBillLine) ?? [];
  const tasks = session?.waiterTasks
    .filter((task) => task.waiterId === waiter.id && task.status !== "cancelled")
    .map(toWaiterTask) ?? [];
  const total = billLines.reduce((sum, line) => sum + line.qty * line.price, 0);

  return {
    waiter,
    table: hallTable,
    requests,
    tasks,
    billLines,
    total,
    note: session?.note?.content ?? "",
    doneCooldownRemainingSec: remainingSeconds(session?.doneCooldownUntil?.getTime() ?? 0, Date.now()),
    reviewPrompt: toReviewPrompt(
      session?.reviewPrompts.find((prompt) => prompt.expiresAt.getTime() > Date.now()),
    ),
    timeline: [],
  };
}

export function toWaiterTableSummary(table: TableRecord) {
  const session = getActiveSession(table);
  const activeRequest = session?.requests
    .filter((request) => !request.resolvedAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  return {
    ...toHallTable(table),
    activeRequest: activeRequest ? toServiceRequest(activeRequest) : undefined,
    openTasksCount:
      session?.waiterTasks.filter((task) => task.status !== "completed" && task.status !== "cancelled").length ?? 0,
    urgentTasksCount:
      session?.waiterTasks.filter(
        (task) =>
          task.priority === "urgent" && task.status !== "completed" && task.status !== "cancelled",
      ).length ?? 0,
  };
}

export async function getHallProjection(): Promise<HallData> {
  await ensureStaffBackendReady();

  const [waiters, managers, tables, settings, assignments, dbReviews] = await Promise.all([
    prisma.staffUser.findMany({
      where: { role: "waiter" },
      orderBy: { name: "asc" },
    }),
    prisma.staffUser.findMany({
      where: { role: "manager" },
      orderBy: { name: "asc" },
    }),
    prisma.restaurantTable.findMany({
      where: { archivedAt: null },
      orderBy: { id: "asc" },
      include: {
        assignments: {
          where: { endedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { waiter: true },
        },
        sessions: {
          where: { closedAt: null },
          orderBy: { startedAt: "desc" },
          take: 1,
          include: {
            requests: {
              orderBy: { createdAt: "desc" },
            },
            billLines: {
              orderBy: { createdAt: "asc" },
            },
            waiterTasks: {
              orderBy: { createdAt: "desc" },
            },
            waiterOrderBatches: {
              orderBy: { createdAt: "desc" },
              include: { billLines: true },
            },
            note: true,
            reviewPrompts: {
              where: {
                resolvedAt: null,
                expiresAt: { gt: new Date() },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    }),
    prisma.restaurantSettings.findUnique({ where: { id: 1 } }),
    prisma.tableAssignment.findMany({
      where: { endedAt: null },
      orderBy: [{ waiterId: "asc" }, { tableId: "asc" }, { createdAt: "desc" }],
    }),
    prisma.guestReview.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const uniqueAssignments = new Map<number, string>();
  for (const assignment of assignments) {
    if (!uniqueAssignments.has(assignment.tableId)) {
      uniqueAssignments.set(assignment.tableId, assignment.waiterId);
    }
  }

  const tableIdsByWaiter = new Map<string, number[]>();
  for (const [tableId, waiterId] of Array.from(uniqueAssignments.entries())) {
    const list = tableIdsByWaiter.get(waiterId) ?? [];
    list.push(tableId);
    tableIdsByWaiter.set(waiterId, list);
  }

  const notesByTable: Record<string, string> = {};
  const notesBySession: Record<string, string> = {};
  const requestCooldowns: Record<string, Partial<Record<ServiceRequestType, number>>> = {};
  const reviewPrompts: Record<string, ReviewPrompt> = {};

  for (const table of tables) {
    const session = getActiveSession(table);
    if (!session) continue;

    if (session.note?.content) {
      notesByTable[String(table.id)] = session.note.content;
      notesBySession[`${table.id}:${session.startedAt.getTime()}`] = session.note.content;
    }

    requestCooldowns[String(table.id)] = {
      waiter: session.waiterCooldownUntil?.getTime(),
      bill: session.billCooldownUntil?.getTime(),
    };

    const prompt = toReviewPrompt(
      session.reviewPrompts.find((candidate) => candidate.expiresAt.getTime() > Date.now()),
    );
    if (prompt) {
      reviewPrompts[String(table.id)] = prompt;
    }
  }

  const reviews: Review[] = dbReviews.map((review) => ({
    tableId: review.tableId,
    waiterId: review.waiterId ?? undefined,
    rating: review.rating,
    comment: review.comment ?? undefined,
    createdAt: review.createdAt.getTime(),
  }));

  return {
    waiters: waiters.map((waiter) =>
      normalizeWaiter(waiter, (tableIdsByWaiter.get(waiter.id) ?? []).sort((a, b) => a - b)),
    ),
    managers: managers.map(normalizeManager),
    tables: tables.map(toHallTable),
    requests: tables.flatMap((table) => getActiveSession(table)?.requests.map(toServiceRequest) ?? []),
    billLines: tables.flatMap((table) => getActiveSession(table)?.billLines.map(toBillLine) ?? []),
    notesByTable,
    notesBySession,
    requestCooldowns,
    reviews,
    reviewPrompts,
    floorPlan: asFloorPlan(settings?.floorPlan),
    settings: {
      managerSoundEnabled: settings?.managerSoundEnabled ?? true,
    },
  };
}
