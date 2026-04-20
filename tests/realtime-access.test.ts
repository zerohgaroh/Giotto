import assert from "node:assert/strict";
import test from "node:test";
import { applyWaiterAssignmentChange, canWaiterReceiveRealtimeEvent } from "../src/lib/staff-backend/realtime-access";
import type { RealtimeEvent } from "../src/lib/waiter-backend/types";

function createEvent(overrides: Partial<RealtimeEvent>): RealtimeEvent {
  return {
    id: "evt-1",
    type: "table:status_changed",
    tableId: 7,
    ts: 1_717_171_717_171,
    payload: {},
    ...overrides,
  };
}

test("waiter reassignment events remove and grant table access without reconnect", () => {
  const waiterId = "waiter-1";
  const allowedTableIds = new Set([4, 7]);

  applyWaiterAssignmentChange(
    waiterId,
    allowedTableIds,
    createEvent({
      type: "table:assignment_changed",
      tableId: 7,
      payload: {
        previousWaiterId: "waiter-1",
        nextWaiterId: "waiter-2",
      },
    }),
  );

  assert.deepEqual(Array.from(allowedTableIds).sort((left, right) => left - right), [4]);
  assert.equal(
    canWaiterReceiveRealtimeEvent(
      waiterId,
      allowedTableIds,
      createEvent({
        type: "waiter:called",
        tableId: 7,
      }),
    ),
    false,
  );

  applyWaiterAssignmentChange(
    waiterId,
    allowedTableIds,
    createEvent({
      type: "table:assignment_changed",
      tableId: 9,
      payload: {
        previousWaiterId: "waiter-2",
        nextWaiterId: "waiter-1",
      },
    }),
  );

  assert.deepEqual(Array.from(allowedTableIds).sort((left, right) => left - right), [4, 9]);
  assert.equal(
    canWaiterReceiveRealtimeEvent(
      waiterId,
      allowedTableIds,
      createEvent({
        type: "waiter:called",
        tableId: 9,
      }),
    ),
    true,
  );
});

test("waiter receives assignment removal event before table access is dropped", () => {
  const waiterId = "waiter-1";
  const allowedTableIds = new Set([7]);
  const event = createEvent({
    type: "table:assignment_changed",
    tableId: 7,
    payload: {
      previousWaiterId: "waiter-1",
      nextWaiterId: "waiter-2",
    },
  });

  assert.equal(canWaiterReceiveRealtimeEvent(waiterId, allowedTableIds, event), true);
  applyWaiterAssignmentChange(waiterId, allowedTableIds, event);
  assert.equal(canWaiterReceiveRealtimeEvent(waiterId, allowedTableIds, createEvent({ tableId: 7 })), false);
});

test("waiter receives assignment grant event before table access is added", () => {
  const waiterId = "waiter-1";
  const allowedTableIds = new Set([4]);
  const event = createEvent({
    type: "table:assignment_changed",
    tableId: 9,
    payload: {
      previousWaiterId: "waiter-2",
      nextWaiterId: "waiter-1",
    },
  });

  assert.equal(canWaiterReceiveRealtimeEvent(waiterId, allowedTableIds, event), true);
  applyWaiterAssignmentChange(waiterId, allowedTableIds, event);
  assert.equal(canWaiterReceiveRealtimeEvent(waiterId, allowedTableIds, createEvent({ tableId: 9 })), true);
});

test("manager-style access sees every realtime event", () => {
  assert.equal(
    canWaiterReceiveRealtimeEvent(
      null,
      null,
      createEvent({
        type: "menu:changed",
        tableId: 22,
      }),
    ),
    true,
  );
});
