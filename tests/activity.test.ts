import assert from "node:assert/strict";
import test from "node:test";
import { parseHistoryCursor, publishActivityEvents, serializeHistoryCursor } from "../src/lib/staff-backend/activity";
import { subscribeRealtimeEvents } from "../src/lib/waiter-backend/realtime";

test("history cursor round-trips through serialization", () => {
  const cursor = serializeHistoryCursor({ ts: 1_717_171_717_171, id: "evt-123" });
  assert.deepEqual(parseHistoryCursor(cursor), {
    ts: 1_717_171_717_171,
    id: "evt-123",
  });
});

test("history cursor parser returns null for invalid input", () => {
  assert.equal(parseHistoryCursor("not-base64"), null);
  assert.equal(
    parseHistoryCursor(Buffer.from(JSON.stringify({ ts: "bad", id: 123 }), "utf8").toString("base64url")),
    null,
  );
});

test("activity realtime publish preserves missing table id", async () => {
  const received = await new Promise((resolve) => {
    const unsubscribe = subscribeRealtimeEvents((event) => {
      unsubscribe();
      resolve(event);
    });

    publishActivityEvents([
      {
        id: "evt-no-table",
        type: "shift:summary_changed",
        actorRole: "system",
        actorId: "waiter-1",
        ts: 1_717_171_717_171,
        payload: { waiterId: "waiter-1" },
        publishRealtime: true,
      },
    ]);
  });

  assert.equal((received as { tableId?: number }).tableId, undefined);
});
