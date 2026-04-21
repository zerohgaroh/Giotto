import { prisma } from "./prisma";
import { appendActivityEvents, publishActivityEvents } from "./activity";

declare global {
  // eslint-disable-next-line no-var
  var __giottoStaffMaintenancePromise: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __giottoStaffMaintenanceAt: number | undefined;
}

const MAINTENANCE_THROTTLE_MS = 30_000;
const DEFAULT_IDLE_AUTO_CLOSE_MIN = 90;
const DEFAULT_MAX_SESSION_MIN = 720;

type SessionCloseCandidate = {
  sessionId: string;
  tableId: number;
  waiterId?: string;
  reason: "max_duration" | "idle_timeout";
};

function readPositiveMinutes(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function toMs(minutes: number) {
  return minutes * 60_000;
}

function maxTimestamp(values: Array<Date | null | undefined>) {
  return values.reduce((max, value) => {
    const next = value?.getTime() ?? 0;
    return next > max ? next : max;
  }, 0);
}

function collectSessionActivityAt(session: {
  startedAt: Date;
  updatedAt: Date;
  requests: Array<{ createdAt: Date; acknowledgedAt: Date | null; resolvedAt: Date | null }>;
  billLines: Array<{ createdAt: Date }>;
  waiterTasks: Array<{
    createdAt: Date;
    updatedAt: Date;
    acknowledgedAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
  }>;
  note: { updatedAt: Date } | null;
  reviewPrompts: Array<{ createdAt: Date; expiresAt: Date; resolvedAt: Date | null }>;
}) {
  return maxTimestamp([
    session.startedAt,
    session.updatedAt,
    session.note?.updatedAt,
    ...session.requests.flatMap((request) => [request.createdAt, request.acknowledgedAt, request.resolvedAt]),
    ...session.billLines.map((line) => line.createdAt),
    ...session.waiterTasks.flatMap((task) => [
      task.createdAt,
      task.updatedAt,
      task.acknowledgedAt,
      task.startedAt,
      task.completedAt,
      task.cancelledAt,
    ]),
    ...session.reviewPrompts.flatMap((prompt) => [prompt.createdAt, prompt.expiresAt, prompt.resolvedAt]),
  ]);
}

async function runStaffBackendMaintenanceNow() {
  const now = new Date();
  const nowMs = now.getTime();
  const idleAutoCloseMs = toMs(
    readPositiveMinutes(process.env.GIOTTO_TABLE_IDLE_AUTO_CLOSE_MIN, DEFAULT_IDLE_AUTO_CLOSE_MIN),
  );
  const maxSessionMs = toMs(
    readPositiveMinutes(process.env.GIOTTO_TABLE_MAX_SESSION_MIN, DEFAULT_MAX_SESSION_MIN),
  );

  await prisma.reviewPrompt.updateMany({
    where: {
      resolvedAt: null,
      expiresAt: { lte: now },
    },
    data: { resolvedAt: now },
  });

  const activeSessions = await prisma.tableSession.findMany({
    where: { closedAt: null },
    include: {
      table: {
        include: {
          assignments: {
            where: { endedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      requests: {
        select: {
          createdAt: true,
          acknowledgedAt: true,
          resolvedAt: true,
        },
      },
      billLines: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { createdAt: true },
      },
      waiterTasks: {
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          createdAt: true,
          updatedAt: true,
          acknowledgedAt: true,
          startedAt: true,
          completedAt: true,
          cancelledAt: true,
        },
      },
      note: {
        select: { updatedAt: true },
      },
      reviewPrompts: {
        select: {
          createdAt: true,
          expiresAt: true,
          resolvedAt: true,
        },
      },
    },
  });

  const sessionsToClose = activeSessions.reduce<SessionCloseCandidate[]>((list, session) => {
      const startedAtMs = session.startedAt.getTime();
      const lastActivityAtMs = collectSessionActivityAt(session);
      const reachedIdleLimit = nowMs - lastActivityAtMs >= idleAutoCloseMs;
      const reachedMaxDuration = nowMs - startedAtMs >= maxSessionMs;

      if (!reachedIdleLimit && !reachedMaxDuration) return list;

      list.push({
        sessionId: session.id,
        tableId: session.tableId,
        waiterId: session.table.assignments[0]?.waiterId,
        reason: reachedMaxDuration ? "max_duration" : "idle_timeout",
      });

      return list;
    }, []);

  if (sessionsToClose.length === 0) return;

  for (const session of sessionsToClose) {
    await prisma.$transaction(async (tx) => {
      await tx.waiterTask.updateMany({
        where: {
          tableSessionId: session.sessionId,
          status: { in: ["open", "acknowledged", "in_progress"] },
        },
        data: {
          status: "cancelled",
          cancelledAt: now,
        },
      });

      await tx.serviceRequest.updateMany({
        where: {
          tableSessionId: session.sessionId,
          resolvedAt: null,
        },
        data: {
          resolvedAt: now,
        },
      });

      await tx.reviewPrompt.updateMany({
        where: {
          tableSessionId: session.sessionId,
          resolvedAt: null,
        },
        data: {
          resolvedAt: now,
        },
      });

      await tx.tableSession.update({
        where: { id: session.sessionId },
        data: {
          closedAt: now,
        },
      });
    });

    const events = await appendActivityEvents([
      {
        type: "table:status_changed",
        actorRole: "system",
        actorId: "system",
        tableId: session.tableId,
        tableSessionId: session.sessionId,
        payload: {
          to: "free",
          action: "auto_closed",
          reason: session.reason,
        },
      },
      {
        type: "task:updated",
        actorRole: "system",
        actorId: "system",
        tableId: session.tableId,
        tableSessionId: session.sessionId,
        payload: {
          status: "cancelled",
          reason: session.reason,
        },
      },
      ...(session.waiterId
        ? [
            {
              type: "shift:summary_changed" as const,
              actorRole: "system" as const,
              actorId: session.waiterId,
              tableId: session.tableId,
              tableSessionId: session.sessionId,
              payload: { waiterId: session.waiterId },
            },
          ]
        : []),
    ]);
    publishActivityEvents(events);
  }
}

export async function maybeRunStaffBackendMaintenance() {
  const now = Date.now();

  if (
    globalThis.__giottoStaffMaintenancePromise &&
    (globalThis.__giottoStaffMaintenanceAt ?? 0) + MAINTENANCE_THROTTLE_MS > now
  ) {
    await globalThis.__giottoStaffMaintenancePromise;
    return;
  }

  if ((globalThis.__giottoStaffMaintenanceAt ?? 0) + MAINTENANCE_THROTTLE_MS > now) {
    return;
  }

  globalThis.__giottoStaffMaintenanceAt = now;
  globalThis.__giottoStaffMaintenancePromise = runStaffBackendMaintenanceNow().finally(() => {
    globalThis.__giottoStaffMaintenancePromise = undefined;
  });

  await globalThis.__giottoStaffMaintenancePromise;
}
