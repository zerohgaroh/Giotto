import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { publishRealtimeEvent } from "@/lib/waiter-backend/realtime";
import type { ActivityActorRole, ManagerHistoryEntry, RealtimeEventType } from "./types";

export type ActivityEventInput = {
  type: string;
  actorRole: ActivityActorRole;
  actorId?: string;
  tableId?: number;
  tableSessionId?: string;
  payload?: Record<string, unknown>;
  publishRealtime?: boolean;
};

export type StoredActivityEvent = ManagerHistoryEntry & {
  publishRealtime: boolean;
};

export async function appendActivityEvents(events: ActivityEventInput[]): Promise<StoredActivityEvent[]> {
  if (events.length === 0) return [];

  const now = Date.now();
  const normalized = events.map((event, index) => ({
    id: randomUUID(),
    type: event.type,
    actorRole: event.actorRole,
    actorId: event.actorId,
    tableId: event.tableId,
    tableSessionId: event.tableSessionId,
    ts: now + index,
    payload: event.payload,
    publishRealtime: event.publishRealtime ?? true,
  }));

  await prisma.serviceActivityEvent.createMany({
    data: normalized.map((event) => ({
      id: event.id,
      type: event.type,
      actorRole: event.actorRole,
      actorId: event.actorId,
      tableId: event.tableId,
      tableSessionId: event.tableSessionId,
      payload: event.payload as Prisma.InputJsonValue | undefined,
      createdAt: new Date(event.ts),
    })),
  });

  return normalized;
}

export function publishActivityEvents(events: StoredActivityEvent[]) {
  for (const event of events) {
    if (!event.publishRealtime) continue;
    publishRealtimeEvent({
      id: event.id,
      ts: event.ts,
      type: event.type as RealtimeEventType,
      tableId: event.tableId ?? 0,
      actor: event.actorId ?? event.actorRole,
      payload: event.payload,
    });
  }
}

export function serializeHistoryCursor(event: { ts: number; id: string }) {
  return Buffer.from(JSON.stringify(event), "utf8").toString("base64url");
}

export function parseHistoryCursor(cursor: string | null | undefined): { ts: number; id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      ts?: number;
      id?: string;
    };
    if (typeof decoded.ts !== "number" || typeof decoded.id !== "string") {
      return null;
    }
    return {
      ts: decoded.ts,
      id: decoded.id,
    };
  } catch {
    return null;
  }
}
