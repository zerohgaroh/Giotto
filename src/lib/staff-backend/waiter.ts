import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import {
  ApiError,
  ensureActiveSession,
  getActiveSession,
  getAssignedTableRecord,
  loadWaiterProfile,
  toWaiterTableDetail,
  toWaiterTableSummary,
  type TableRecord,
} from "./projections";
import { appendActivityEvents, publishActivityEvents } from "./activity";
import { getReviewHistoryPage, getWaiterReviewMetrics } from "./reviews";
import { getReviewPromptTtlMs } from "./review-prompt-config";
import type {
  PushDeviceRegistration,
  RepeatLastOrderInput,
  ReviewHistoryPage,
  WaiterOrderInput,
  WaiterQueueResponse,
  WaiterShiftSummary,
  WaiterShortcuts,
  WaiterTableDetail,
  WaiterTableTimelineEntry,
  WaiterTask,
  WaiterTablesResponse,
} from "./types";

const ACTIVE_TASK_STATUSES = ["open", "acknowledged", "in_progress"] as const;

const WAITER_TABLE_INCLUDE = {
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
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
};

function normalizeShortcuts(raw: {
  favoriteDishIds?: unknown;
  noteTemplates?: unknown;
  quickOrderPresets?: unknown;
} | null): WaiterShortcuts {
  const favoriteDishIds = Array.isArray(raw?.favoriteDishIds)
    ? Array.from(
        new Set(
          raw.favoriteDishIds
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item) => item.trim()),
        ),
      )
    : [];

  const noteTemplates = Array.isArray(raw?.noteTemplates)
    ? Array.from(
        new Set(
          raw.noteTemplates
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item) => item.trim()),
        ),
      ).slice(0, 12)
    : [];

  const quickOrderPresets = Array.isArray(raw?.quickOrderPresets)
    ? raw.quickOrderPresets
        .filter(
          (
            item,
          ): item is {
            id?: unknown;
            title?: unknown;
            items?: unknown;
          } => !!item && typeof item === "object" && !Array.isArray(item),
        )
        .map((preset) => ({
          id: typeof preset.id === "string" && preset.id.trim() ? preset.id.trim() : `preset-${randomUUID()}`,
          title: typeof preset.title === "string" && preset.title.trim() ? preset.title.trim() : "Quick preset",
          items: Array.isArray(preset.items)
            ? preset.items
                .filter(
                  (item): item is { dishId?: unknown; qty?: unknown } =>
                    !!item && typeof item === "object" && !Array.isArray(item),
                )
                .map((item) => ({
                  dishId: typeof item.dishId === "string" ? item.dishId.trim() : "",
                  qty: Math.max(1, Math.floor(Number(item.qty ?? 1))),
                }))
                .filter((item) => item.dishId)
            : [],
        }))
        .filter((preset) => preset.items.length > 0)
        .slice(0, 12)
    : [];

  return {
    favoriteDishIds,
    noteTemplates,
    quickOrderPresets,
  };
}

function sortQueueTasks(tasks: WaiterTask[]) {
  return tasks.sort((left, right) => {
    const leftPriority = left.priority === "urgent" ? 0 : 1;
    const rightPriority = right.priority === "urgent" ? 0 : 1;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.createdAt - right.createdAt;
  });
}

async function getAssignedTables(waiterId: string): Promise<TableRecord[]> {
  return prisma.restaurantTable.findMany({
    where: {
      assignments: {
        some: {
          waiterId,
          endedAt: null,
        },
      },
      archivedAt: null,
    },
    orderBy: { id: "asc" },
    include: WAITER_TABLE_INCLUDE,
  }) as Promise<TableRecord[]>;
}

async function loadTimeline(tableSessionId?: string): Promise<WaiterTableTimelineEntry[]> {
  if (!tableSessionId) return [];

  const events = await prisma.serviceActivityEvent.findMany({
    where: { tableSessionId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 40,
  });

  return events.map((event) => ({
    id: event.id,
    type: event.type,
    ts: event.createdAt.getTime(),
    actorRole: event.actorRole,
    actorId: event.actorId ?? undefined,
    payload:
      event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
        ? (event.payload as Record<string, unknown>)
        : undefined,
  }));
}

async function loadWaiterTableWithTimeline(waiterId: string, tableId: number): Promise<WaiterTableDetail> {
  const waiter = await loadWaiterProfile(waiterId);
  const table = await getAssignedTableRecord(tableId, waiterId);
  const detail = toWaiterTableDetail(waiter, table);
  const activeSession = getActiveSession(table);
  return {
    ...detail,
    timeline: await loadTimeline(activeSession?.id),
  };
}

async function ensureAvailableDishes(items: WaiterOrderInput[]) {
  const dishIds = Array.from(
    new Set(items.map((item) => item.dishId?.trim()).filter((dishId): dishId is string => !!dishId)),
  );

  if (dishIds.length === 0) return;

  const dishes = await prisma.dish.findMany({
    where: {
      id: { in: dishIds },
      available: true,
    },
    select: { id: true },
  });

  if (dishes.length !== dishIds.length) {
    throw new ApiError(409, "One or more dishes are unavailable");
  }
}

async function notifyShiftChanged(waiterId: string, tableId?: number) {
  const events = await appendActivityEvents([
    {
      type: "shift:summary_changed",
      actorRole: "system",
      actorId: waiterId,
      tableId,
      payload: { waiterId },
    },
  ]);
  publishActivityEvents(events);
}

async function loadActiveTask(taskId: string, waiterId: string) {
  const task = await prisma.waiterTask.findFirst({
    where: {
      id: taskId,
      waiterId,
    },
    include: {
      sourceRequest: true,
    },
  });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return task;
}

export async function getWaiterTables(waiterId: string): Promise<WaiterTablesResponse> {
  const waiter = await loadWaiterProfile(waiterId);
  const tables = await getAssignedTables(waiterId);

  return {
    waiter,
    tables: tables.map(toWaiterTableSummary),
  };
}

export async function getWaiterQueue(waiterId: string): Promise<WaiterQueueResponse> {
  const [waiter, tasks, tables] = await Promise.all([
    loadWaiterProfile(waiterId),
    prisma.waiterTask.findMany({
      where: {
        waiterId,
        status: { in: [...ACTIVE_TASK_STATUSES] },
        tableSession: {
          closedAt: null,
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    getAssignedTables(waiterId),
  ]);

  const normalized = sortQueueTasks(
    tasks.map((task) => ({
      id: task.id,
      tableId: task.tableId,
      tableSessionId: task.tableSessionId,
      waiterId: task.waiterId ?? undefined,
      type: task.type,
      priority: task.priority,
      status: task.status,
      sourceRequestId: task.sourceRequestId ?? undefined,
      title: task.title,
      subtitle: task.subtitle ?? undefined,
      note: task.note ?? undefined,
      createdAt: task.createdAt.getTime(),
      acknowledgedAt: task.acknowledgedAt?.getTime(),
      startedAt: task.startedAt?.getTime(),
      completedAt: task.completedAt?.getTime(),
      dueAt: task.dueAt?.getTime(),
    })),
  );

  const tablesNeedingAttention = Array.from(new Set(normalized.map((task) => task.tableId))).sort((a, b) => a - b);

  return {
    waiter,
      summary: {
      urgentCount: normalized.filter((task) => task.priority === "urgent").length,
      inProgressCount: normalized.filter((task) => task.status === "in_progress").length,
      activeTablesCount: tables.filter((table) => !!getActiveSession(table)).length,
    },
    tasks: normalized,
    tablesNeedingAttention,
  };
}

export async function getWaiterTableDetail(waiterId: string, tableId: number): Promise<WaiterTableDetail> {
  return loadWaiterTableWithTimeline(waiterId, tableId);
}

export async function acknowledgeWaiterRequest(input: {
  waiterId: string;
  tableId: number;
  requestId?: string;
}): Promise<WaiterTableDetail> {
  const table = await getAssignedTableRecord(input.tableId, input.waiterId);
  const activeSession = getActiveSession(table);

  if (!activeSession) {
    throw new ApiError(409, "Active request was not found");
  }

  const request = activeSession.requests
    .filter((candidate) => !candidate.resolvedAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .find((candidate) => (input.requestId ? candidate.id === input.requestId : true));

  if (!request) {
    throw new ApiError(409, "Active request was not found");
  }

  const task = activeSession.waiterTasks.find((candidate) => candidate.sourceRequestId === request.id);
  if (!task) {
    throw new ApiError(409, "Task for the request was not found");
  }

  return acknowledgeWaiterTask({
    waiterId: input.waiterId,
    taskId: task.id,
  });
}

export async function acknowledgeWaiterTask(input: {
  waiterId: string;
  taskId: string;
}): Promise<WaiterTableDetail> {
  const task = await loadActiveTask(input.taskId, input.waiterId);
  if (task.status === "cancelled" || task.status === "completed") {
    return loadWaiterTableWithTimeline(input.waiterId, task.tableId);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.waiterTask.update({
      where: { id: task.id },
      data: {
        status: task.status === "open" ? "acknowledged" : task.status,
        acknowledgedAt: task.acknowledgedAt ?? now,
      },
    });

    if (task.sourceRequestId && (!task.sourceRequest?.resolvedAt || !task.sourceRequest?.acknowledgedAt)) {
      await tx.serviceRequest.update({
        where: { id: task.sourceRequestId },
        data: {
          acknowledgedAt: now,
          acknowledgedById: input.waiterId,
          resolvedAt: now,
        },
      });
    }
  });

  const detail = await loadWaiterTableWithTimeline(input.waiterId, task.tableId);
  const events = await appendActivityEvents([
    ...(task.sourceRequestId
      ? [
          {
            type: "waiter:acknowledged",
            actorRole: "waiter" as const,
            actorId: input.waiterId,
            tableId: task.tableId,
            tableSessionId: task.tableSessionId,
            payload: {
              requestId: task.sourceRequestId,
              acknowledgedAt: now.getTime(),
              requestType: task.sourceRequest?.type,
            },
          },
          {
            type: "table:status_changed",
            actorRole: "system" as const,
            actorId: "system",
            tableId: task.tableId,
            tableSessionId: task.tableSessionId,
            payload: { to: detail.table.status },
          },
        ]
      : []),
    {
      type: "task:updated",
      actorRole: "waiter",
      actorId: input.waiterId,
      tableId: task.tableId,
      tableSessionId: task.tableSessionId,
      payload: {
        taskId: task.id,
        status: task.status === "open" ? "acknowledged" : task.status,
        waiterId: input.waiterId,
      },
    },
  ]);
  publishActivityEvents(events);
  await notifyShiftChanged(input.waiterId, task.tableId);

  return loadWaiterTableWithTimeline(input.waiterId, task.tableId);
}

export async function startWaiterTask(input: {
  waiterId: string;
  taskId: string;
}): Promise<WaiterTableDetail> {
  const task = await loadActiveTask(input.taskId, input.waiterId);
  if (task.status === "cancelled" || task.status === "completed") {
    return loadWaiterTableWithTimeline(input.waiterId, task.tableId);
  }

  const now = new Date();
  let acknowledgedSourceRequest = false;

  await prisma.$transaction(async (tx) => {
    await tx.waiterTask.update({
      where: { id: task.id },
      data: {
        status: "in_progress",
        acknowledgedAt: task.acknowledgedAt ?? now,
        startedAt: task.startedAt ?? now,
      },
    });

    if (task.sourceRequestId && (!task.sourceRequest?.resolvedAt || !task.sourceRequest?.acknowledgedAt)) {
      acknowledgedSourceRequest = true;
      await tx.serviceRequest.update({
        where: { id: task.sourceRequestId },
        data: {
          acknowledgedAt: now,
          acknowledgedById: input.waiterId,
          resolvedAt: now,
        },
      });
    }
  });

  const detail = await loadWaiterTableWithTimeline(input.waiterId, task.tableId);
  const events = await appendActivityEvents([
    ...(acknowledgedSourceRequest
      ? [
          {
            type: "waiter:acknowledged",
            actorRole: "waiter" as const,
            actorId: input.waiterId,
            tableId: task.tableId,
            tableSessionId: task.tableSessionId,
            payload: {
              requestId: task.sourceRequestId,
              acknowledgedAt: now.getTime(),
              requestType: task.sourceRequest?.type,
            },
          },
          {
            type: "table:status_changed",
            actorRole: "system" as const,
            actorId: "system",
            tableId: task.tableId,
            tableSessionId: task.tableSessionId,
            payload: { to: detail.table.status },
          },
        ]
      : []),
    {
      type: "task:updated",
      actorRole: "waiter",
      actorId: input.waiterId,
      tableId: task.tableId,
      tableSessionId: task.tableSessionId,
      payload: {
        taskId: task.id,
        status: "in_progress",
        waiterId: input.waiterId,
      },
    },
  ]);
  publishActivityEvents(events);
  await notifyShiftChanged(input.waiterId, task.tableId);

  return detail;
}

export async function completeWaiterTask(input: {
  waiterId: string;
  taskId: string;
  mutationKey?: string;
}): Promise<WaiterTableDetail> {
  const task = await loadActiveTask(input.taskId, input.waiterId);

  if (
    task.status === "completed" &&
    (!input.mutationKey || task.completionMutationKey === input.mutationKey || !task.completionMutationKey)
  ) {
    return loadWaiterTableWithTimeline(input.waiterId, task.tableId);
  }
  if (task.status === "cancelled") {
    return loadWaiterTableWithTimeline(input.waiterId, task.tableId);
  }

  const now = new Date();
  let acknowledgedSourceRequest = false;

  await prisma.$transaction(async (tx) => {
    await tx.waiterTask.update({
      where: { id: task.id },
      data: {
        status: "completed",
        acknowledgedAt: task.acknowledgedAt ?? now,
        startedAt: task.startedAt ?? task.acknowledgedAt ?? now,
        completedAt: now,
        completionMutationKey: input.mutationKey,
      },
    });

    if (task.sourceRequestId && (!task.sourceRequest?.resolvedAt || !task.sourceRequest?.acknowledgedAt)) {
      acknowledgedSourceRequest = true;
      await tx.serviceRequest.update({
        where: { id: task.sourceRequestId },
        data: {
          acknowledgedAt: now,
          acknowledgedById: input.waiterId,
          resolvedAt: now,
        },
      });

      if (task.sourceRequest?.type === "bill") {
        await tx.tableSession.update({
          where: { id: task.tableSessionId },
          data: {
            billCooldownUntil: now,
          },
        });
      } else if (task.sourceRequest?.type === "waiter") {
        await tx.tableSession.update({
          where: { id: task.tableSessionId },
          data: {
            waiterCooldownUntil: now,
          },
        });
      }
    }
  });

  const detail = await loadWaiterTableWithTimeline(input.waiterId, task.tableId);
  const events = await appendActivityEvents([
    ...(acknowledgedSourceRequest
      ? [
          {
            type: "waiter:acknowledged",
            actorRole: "waiter" as const,
            actorId: input.waiterId,
            tableId: task.tableId,
            tableSessionId: task.tableSessionId,
            payload: {
              requestId: task.sourceRequestId,
              acknowledgedAt: now.getTime(),
              requestType: task.sourceRequest?.type,
            },
          },
          {
            type: "table:status_changed",
            actorRole: "system" as const,
            actorId: "system",
            tableId: task.tableId,
            tableSessionId: task.tableSessionId,
            payload: { to: detail.table.status },
          },
        ]
      : []),
    {
      type: "task:completed",
      actorRole: "waiter",
      actorId: input.waiterId,
      tableId: task.tableId,
      tableSessionId: task.tableSessionId,
      payload: {
        taskId: task.id,
        status: "completed",
        waiterId: input.waiterId,
      },
    },
  ]);
  publishActivityEvents(events);
  await notifyShiftChanged(input.waiterId, task.tableId);

  return detail;
}

export async function createWaiterFollowUpTask(input: {
  waiterId: string;
  tableId: number;
  title: string;
  dueInMin?: number;
  note?: string;
}): Promise<WaiterTableDetail> {
  await getAssignedTableRecord(input.tableId, input.waiterId);
  const title = input.title.trim();
  if (!title) {
    throw new ApiError(400, "Follow-up title is required");
  }

  const now = new Date();
  let taskId = "";
  let tableSessionId = "";

  await prisma.$transaction(async (tx) => {
    const session = await ensureActiveSession(input.tableId, tx, now);
    tableSessionId = session.id;

    const created = await tx.waiterTask.create({
      data: {
        tableSessionId: session.id,
        tableId: input.tableId,
        waiterId: input.waiterId,
        type: "follow_up",
        priority: "normal",
        status: "open",
        title,
        subtitle: input.note?.trim() || undefined,
        note: input.note?.trim() || undefined,
        dueAt: input.dueInMin ? new Date(now.getTime() + Math.max(1, input.dueInMin) * 60_000) : undefined,
        createdAt: now,
      },
    });
    taskId = created.id;
  });

  const events = await appendActivityEvents([
    {
      type: "task:created",
      actorRole: "waiter",
      actorId: input.waiterId,
      tableId: input.tableId,
      tableSessionId,
      payload: {
        taskId,
        waiterId: input.waiterId,
        status: "open",
      },
    },
  ]);
  publishActivityEvents(events);
  await notifyShiftChanged(input.waiterId, input.tableId);

  return loadWaiterTableWithTimeline(input.waiterId, input.tableId);
}

export async function addWaiterOrder(input: {
  waiterId: string;
  tableId: number;
  items: WaiterOrderInput[];
  mutationKey?: string;
  repeatedFromBatchId?: string;
}): Promise<WaiterTableDetail> {
  const waiter = await loadWaiterProfile(input.waiterId);
  await getAssignedTableRecord(input.tableId, input.waiterId);

  const validItems = input.items
    .map((item) => ({
      dishId: item.dishId?.trim() || undefined,
      title: String(item.title ?? "").trim(),
      qty: Math.max(0, Math.floor(Number(item.qty ?? 0))),
      price: Math.max(0, Math.floor(Number(item.price ?? 0))),
      note: item.note?.trim() || undefined,
    }))
    .filter((item) => item.title && item.qty > 0);

  if (validItems.length === 0) {
    throw new ApiError(400, "At least one bill line is required");
  }

  await ensureAvailableDishes(validItems);

  if (input.mutationKey) {
    const existingBatch = await prisma.waiterOrderBatch.findUnique({
      where: { clientMutationKey: input.mutationKey },
    });

    if (existingBatch && existingBatch.waiterId === input.waiterId) {
      return loadWaiterTableWithTimeline(input.waiterId, existingBatch.tableId);
    }
  }

  const now = new Date();
  let tableSessionId = "";
  let waiterOrderBatchId = "";

  await prisma.$transaction(async (tx) => {
    const session = await ensureActiveSession(input.tableId, tx, now);
    tableSessionId = session.id;

    const batch = await tx.waiterOrderBatch.create({
      data: {
        tableSessionId: session.id,
        tableId: input.tableId,
        waiterId: input.waiterId,
        clientMutationKey: input.mutationKey,
        repeatedFromBatchId: input.repeatedFromBatchId,
        createdAt: now,
      },
    });
    waiterOrderBatchId = batch.id;

    await tx.billLine.createMany({
      data: validItems.map((item) => ({
        tableSessionId: session.id,
        tableId: input.tableId,
        dishId: item.dishId,
        title: item.title,
        qty: item.qty,
        price: item.price,
        note: item.note,
        source: "waiter",
        createdAt: now,
        waiterOrderBatchId: batch.id,
      })),
    });
  });

  const totalAmount = validItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const events = await appendActivityEvents([
    {
      type: "order:added_by_waiter",
      actorRole: "waiter",
      actorId: input.waiterId,
      tableId: input.tableId,
      tableSessionId,
      payload: {
        lines: validItems.length,
        totalAmount,
        waiterOrderBatchId,
      },
    },
    {
      type: "table:status_changed",
      actorRole: "system",
      actorId: "system",
      tableId: input.tableId,
      tableSessionId,
      payload: { to: "ordered" },
    },
  ]);
  publishActivityEvents(events);
  await notifyShiftChanged(input.waiterId, input.tableId);

  const nextTable = await getAssignedTableRecord(input.tableId, input.waiterId);
  const detail = toWaiterTableDetail(waiter, nextTable);
  return {
    ...detail,
    timeline: await loadTimeline(getActiveSession(nextTable)?.id),
  };
}

export async function repeatLastWaiterOrder(input: {
  waiterId: string;
  tableId: number;
  payload: RepeatLastOrderInput;
}): Promise<WaiterTableDetail> {
  const table = await getAssignedTableRecord(input.tableId, input.waiterId);
  const activeSession = getActiveSession(table);

  if (!activeSession) {
    throw new ApiError(409, "Active table session was not found");
  }

  const requestedSessionId = input.payload.sourceSessionId?.trim();
  if (requestedSessionId && requestedSessionId !== activeSession.id) {
    throw new ApiError(409, "Repeating orders from past sessions is not allowed");
  }

  const batch = await prisma.waiterOrderBatch.findFirst({
    where: {
      tableId: input.tableId,
      tableSessionId: activeSession.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      billLines: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!batch || batch.billLines.length === 0) {
    throw new ApiError(409, "No waiter order is available in active session");
  }

  return addWaiterOrder({
    waiterId: input.waiterId,
    tableId: input.tableId,
    mutationKey: input.payload.mutationKey,
    repeatedFromBatchId: batch.id,
    items: batch.billLines.map((line) => ({
      dishId: line.dishId ?? undefined,
      title: line.title,
      qty: line.qty,
      price: line.price,
      note: line.note ?? undefined,
    })),
  });
}

export async function getWaiterShortcuts(waiterId: string): Promise<WaiterShortcuts> {
  await loadWaiterProfile(waiterId);
  const shortcuts = await prisma.waiterShortcutPreference.findUnique({
    where: { waiterId },
  });

  return normalizeShortcuts(
    shortcuts
      ? {
          favoriteDishIds: shortcuts.favoriteDishIds,
          noteTemplates: shortcuts.noteTemplates,
          quickOrderPresets: shortcuts.quickOrderPresets,
        }
      : null,
  );
}

export async function updateWaiterShortcuts(input: {
  waiterId: string;
  payload: WaiterShortcuts;
}): Promise<WaiterShortcuts> {
  await loadWaiterProfile(input.waiterId);
  const normalized = normalizeShortcuts(input.payload);

  await prisma.waiterShortcutPreference.upsert({
    where: { waiterId: input.waiterId },
    update: {
      favoriteDishIds: normalized.favoriteDishIds,
      noteTemplates: normalized.noteTemplates,
      quickOrderPresets: normalized.quickOrderPresets,
    },
    create: {
      waiterId: input.waiterId,
      favoriteDishIds: normalized.favoriteDishIds,
      noteTemplates: normalized.noteTemplates,
      quickOrderPresets: normalized.quickOrderPresets,
    },
  });

  await notifyShiftChanged(input.waiterId);
  return normalized;
}

export async function setWaiterTableNote(input: {
  waiterId: string;
  tableId: number;
  note: string;
}): Promise<WaiterTableDetail> {
  await getAssignedTableRecord(input.tableId, input.waiterId);

  const normalized = input.note.trim();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const session = await ensureActiveSession(input.tableId, tx, now);

    if (!normalized) {
      await tx.sessionNote.deleteMany({
        where: { tableSessionId: session.id },
      });
      return;
    }

    await tx.sessionNote.upsert({
      where: { tableSessionId: session.id },
      update: { content: normalized },
      create: {
        tableSessionId: session.id,
        content: normalized,
      },
    });
  });

  return loadWaiterTableWithTimeline(input.waiterId, input.tableId);
}

export async function markWaiterDone(input: {
  waiterId: string;
  tableId: number;
}): Promise<WaiterTableDetail> {
  await getAssignedTableRecord(input.tableId, input.waiterId);

  const now = new Date();
  const doneCooldownUntil = new Date(now.getTime() + 30_000);
  const reviewPromptTtlMs = getReviewPromptTtlMs();
  const expiresAt = new Date(now.getTime() + reviewPromptTtlMs);
  let tableSessionId = "";
  let reviewPromptId = "";

  await prisma.$transaction(async (tx) => {
    const session = await ensureActiveSession(input.tableId, tx, now);
    tableSessionId = session.id;

    await tx.tableSession.update({
      where: { id: session.id },
      data: {
        doneCooldownUntil,
      },
    });

    const prompt = await tx.reviewPrompt.create({
      data: {
        tableSessionId: session.id,
        tableId: input.tableId,
        waiterId: input.waiterId,
        createdAt: now,
        expiresAt,
      },
    });
    reviewPromptId = prompt.id;
  });

  console.info("[review-prompt] waiter_done_created", {
    tableId: input.tableId,
    waiterId: input.waiterId,
    tableSessionId,
    reviewPromptId,
    expiresAt: expiresAt.toISOString(),
    ttlMs: reviewPromptTtlMs,
  });

  const events = await appendActivityEvents([
    {
      type: "waiter:done",
      actorRole: "waiter",
      actorId: input.waiterId,
      tableId: input.tableId,
      tableSessionId,
      payload: { expiresAt: expiresAt.getTime() },
    },
  ]);
  publishActivityEvents(events);
  await notifyShiftChanged(input.waiterId, input.tableId);

  return loadWaiterTableWithTimeline(input.waiterId, input.tableId);
}

export async function finishWaiterTable(input: {
  waiterId: string;
  tableId: number;
  mutationKey?: string;
}): Promise<WaiterTableDetail> {
  const table = await getAssignedTableRecord(input.tableId, input.waiterId);
  const activeSession = getActiveSession(table);

  if (!activeSession) {
    throw new ApiError(409, "Active table session was not found");
  }

  const now = new Date();
  const reviewPromptTtlMs = getReviewPromptTtlMs();
  const expiresAt = new Date(now.getTime() + reviewPromptTtlMs);
  let reviewPromptId = "";
  let completedTaskIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    const tasks = await tx.waiterTask.findMany({
      where: {
        tableSessionId: activeSession.id,
        waiterId: input.waiterId,
        status: { in: [...ACTIVE_TASK_STATUSES] },
      },
      select: { id: true, acknowledgedAt: true, startedAt: true },
    });
    completedTaskIds = tasks.map((task) => task.id);

    if (completedTaskIds.length > 0) {
      await Promise.all(
        tasks.map((task) =>
          tx.waiterTask.update({
            where: { id: task.id },
            data: {
              status: "completed",
              acknowledgedAt: task.acknowledgedAt ?? now,
              startedAt: task.startedAt ?? task.acknowledgedAt ?? now,
              completedAt: now,
              completionMutationKey: input.mutationKey,
            },
          }),
        ),
      );
    }

    await tx.serviceRequest.updateMany({
      where: {
        tableSessionId: activeSession.id,
        resolvedAt: null,
      },
      data: {
        acknowledgedAt: now,
        acknowledgedById: input.waiterId,
        resolvedAt: now,
      },
    });

    await tx.reviewPrompt.updateMany({
      where: {
        tableSessionId: activeSession.id,
        resolvedAt: null,
      },
      data: { resolvedAt: now },
    });

    const prompt = await tx.reviewPrompt.create({
      data: {
        tableSessionId: activeSession.id,
        tableId: input.tableId,
        waiterId: input.waiterId,
        createdAt: now,
        expiresAt,
      },
    });
    reviewPromptId = prompt.id;

    await tx.tableSession.update({
      where: { id: activeSession.id },
      data: {
        closedAt: now,
        doneCooldownUntil: now,
      },
    });
  });

  console.info("[review-prompt] finish_table_created", {
    tableId: input.tableId,
    waiterId: input.waiterId,
    tableSessionId: activeSession.id,
    reviewPromptId,
    expiresAt: expiresAt.toISOString(),
    ttlMs: reviewPromptTtlMs,
  });

  const events = await appendActivityEvents([
    {
      type: "waiter:done",
      actorRole: "waiter",
      actorId: input.waiterId,
      tableId: input.tableId,
      tableSessionId: activeSession.id,
      payload: {
        expiresAt: expiresAt.getTime(),
        reviewPromptId,
        action: "finish_table",
      },
    },
    ...completedTaskIds.map((taskId) => ({
      type: "task:completed" as const,
      actorRole: "waiter" as const,
      actorId: input.waiterId,
      tableId: input.tableId,
      tableSessionId: activeSession.id,
      payload: {
        taskId,
        status: "completed",
        waiterId: input.waiterId,
        action: "finish_table",
      },
    })),
    {
      type: "table:status_changed",
      actorRole: "system",
      actorId: "system",
      tableId: input.tableId,
      tableSessionId: activeSession.id,
      payload: { to: "free", action: "finish_table" },
    },
    {
      type: "shift:summary_changed",
      actorRole: "system",
      actorId: input.waiterId,
      tableId: input.tableId,
      tableSessionId: activeSession.id,
      payload: { waiterId: input.waiterId },
    },
  ]);
  publishActivityEvents(events);

  return loadWaiterTableWithTimeline(input.waiterId, input.tableId);
}

export async function getWaiterShiftSummary(input: {
  waiterId: string;
  sessionId: string;
}): Promise<WaiterShiftSummary> {
  await loadWaiterProfile(input.waiterId);
  const refreshSession = await prisma.staffRefreshSession.findUnique({
    where: { id: input.sessionId },
    select: { createdAt: true },
  });

  const shiftStartedAt = refreshSession?.createdAt ?? new Date();

  const [tasksHandled, responseTasks, activeTablesCount, waiterOrdersCount, serviceCompletedCount, reviewMetrics] =
    await Promise.all([
      prisma.waiterTask.count({
        where: {
          waiterId: input.waiterId,
          status: "completed",
          completedAt: { gte: shiftStartedAt },
        },
      }),
      prisma.waiterTask.findMany({
        where: {
          waiterId: input.waiterId,
          createdAt: { gte: shiftStartedAt },
          OR: [{ acknowledgedAt: { not: null } }, { startedAt: { not: null } }, { completedAt: { not: null } }],
        },
        select: {
          createdAt: true,
          acknowledgedAt: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      prisma.restaurantTable.count({
        where: {
          archivedAt: null,
          assignments: {
            some: {
              waiterId: input.waiterId,
              endedAt: null,
            },
          },
          sessions: {
            some: {
              closedAt: null,
            },
          },
        },
      }),
      prisma.billLine.count({
        where: {
          source: "waiter",
          createdAt: { gte: shiftStartedAt },
          waiterOrderBatch: {
            waiterId: input.waiterId,
          },
        },
      }),
      prisma.reviewPrompt.count({
        where: {
          waiterId: input.waiterId,
          createdAt: { gte: shiftStartedAt },
        },
      }),
      getWaiterReviewMetrics(input.waiterId),
    ]);

  const responseSeconds = responseTasks
    .map((task) => {
      const responseAt = task.acknowledgedAt ?? task.startedAt ?? task.completedAt;
      if (!responseAt) return null;
      return Math.max(0, Math.round((responseAt.getTime() - task.createdAt.getTime()) / 1000));
    })
    .filter((value): value is number => value !== null);

  return {
    shiftStartedAt: shiftStartedAt.getTime(),
    tasksHandled,
    avgResponseSec:
      responseSeconds.length > 0
        ? Math.round(responseSeconds.reduce((sum, value) => sum + value, 0) / responseSeconds.length)
        : 0,
    activeTablesCount,
    waiterOrdersCount,
    serviceCompletedCount,
    avgRatingAllTime: reviewMetrics.avgRatingAllTime,
    reviewsCountAllTime: reviewMetrics.reviewsCountAllTime,
    commentsCountAllTime: reviewMetrics.commentsCountAllTime,
  };
}

export async function getWaiterReviews(input: {
  waiterId: string;
  cursor?: string;
  limit?: number;
}): Promise<ReviewHistoryPage> {
  await loadWaiterProfile(input.waiterId);
  const page = await getReviewHistoryPage({
    waiterId: input.waiterId,
    cursor: input.cursor,
    limit: input.limit,
  });
  console.info("[reviews] waiter_history_loaded", {
    waiterId: input.waiterId,
    cursor: input.cursor ?? null,
    limit: input.limit ?? null,
    items: page.items.length,
    nextCursor: page.nextCursor ?? null,
    reviewsCountAllTime: page.analytics.reviewsCount,
    avgRatingAllTime: page.analytics.avgRating,
  });
  return page;
}

export async function registerPushDevice(
  session: {
    userId: string;
  },
  input: PushDeviceRegistration,
) {
  if (!input.token.trim()) {
    throw new ApiError(400, "Push token is required");
  }

  await prisma.pushDevice.upsert({
    where: { token: input.token.trim() },
    update: {
      staffUserId: session.userId,
      platform: input.platform,
      deviceId: input.deviceId?.trim() || null,
      appVersion: input.appVersion?.trim() || null,
    },
    create: {
      staffUserId: session.userId,
      token: input.token.trim(),
      platform: input.platform,
      deviceId: input.deviceId?.trim() || null,
      appVersion: input.appVersion?.trim() || null,
    },
  });

  return { ok: true };
}
