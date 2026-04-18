import assert from "node:assert/strict";
import test from "node:test";
import { publishRealtimeEvent, subscribeRealtimeEvents } from "../src/lib/waiter-backend/realtime";

test("publishing realtime events notifies subscribers and fills id/ts", async () => {
  const received = await new Promise<ReturnType<typeof publishRealtimeEvent>>((resolve) => {
    const unsubscribe = subscribeRealtimeEvents((event) => {
      unsubscribe();
      resolve(event);
    });

    publishRealtimeEvent({
      type: "waiter:called",
      tableId: 7,
      actor: "guest",
      payload: { reason: "Need help" },
    });
  });

  assert.equal(received.type, "waiter:called");
  assert.equal(received.tableId, 7);
  assert.equal(received.actor, "guest");
  assert.equal(received.payload?.reason, "Need help");
  assert.equal(typeof received.id, "string");
  assert.ok(received.id.length > 0);
  assert.equal(typeof received.ts, "number");
  assert.ok(received.ts > 0);
});
