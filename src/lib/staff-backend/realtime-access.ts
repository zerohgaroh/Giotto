import type { RealtimeEvent } from "@/lib/waiter-backend/types";

export function applyWaiterAssignmentChange(
  waiterId: string | null,
  allowedTableIds: Set<number> | null,
  event: RealtimeEvent,
) {
  if (!waiterId || !allowedTableIds || event.type !== "table:assignment_changed") {
    return allowedTableIds;
  }

  const previousWaiterId =
    typeof event.payload?.previousWaiterId === "string" ? event.payload.previousWaiterId : undefined;
  const nextWaiterId = typeof event.payload?.nextWaiterId === "string" ? event.payload.nextWaiterId : undefined;

  if (previousWaiterId === waiterId && typeof event.tableId === "number") {
    allowedTableIds.delete(event.tableId);
  }

  if (nextWaiterId === waiterId && typeof event.tableId === "number") {
    allowedTableIds.add(event.tableId);
  }

  return allowedTableIds;
}

export function canWaiterReceiveRealtimeEvent(
  waiterId: string | null,
  allowedTableIds: Set<number> | null,
  event: RealtimeEvent,
) {
  if (!allowedTableIds) return true;
  if (typeof event.tableId === "number") {
    return allowedTableIds.has(event.tableId);
  }

  const payloadWaiterId = typeof event.payload?.waiterId === "string" ? event.payload.waiterId : null;
  return !!waiterId && payloadWaiterId === waiterId;
}
