import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type { RealtimeEvent } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __giottoRealtimeEmitter: EventEmitter | undefined;
}

const realtimeEmitter = globalThis.__giottoRealtimeEmitter ?? new EventEmitter();
if (!globalThis.__giottoRealtimeEmitter) {
  globalThis.__giottoRealtimeEmitter = realtimeEmitter;
}

export function publishRealtimeEvent(
  event: Omit<RealtimeEvent, "id" | "ts"> & Partial<Pick<RealtimeEvent, "id" | "ts">>,
): RealtimeEvent {
  const normalized: RealtimeEvent = {
    ...event,
    id: event.id ?? randomUUID(),
    ts: event.ts ?? Date.now(),
  };

  realtimeEmitter.emit("realtime-event", normalized);
  return normalized;
}

export function subscribeRealtimeEvents(listener: (event: RealtimeEvent) => void): () => void {
  realtimeEmitter.on("realtime-event", listener);
  return () => realtimeEmitter.off("realtime-event", listener);
}
