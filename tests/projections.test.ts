import assert from "node:assert/strict";
import test from "node:test";
import { asFloorPlan, computeStatus, remainingSeconds } from "../src/lib/staff-backend/projections";

test("remainingSeconds clamps to zero or the next whole second", () => {
  assert.equal(remainingSeconds(1_000, 1_000), 0);
  assert.equal(remainingSeconds(999, 1_000), 0);
  assert.equal(remainingSeconds(1_500, 1_000), 1);
  assert.equal(remainingSeconds(3_100, 1_000), 3);
});

test("computeStatus derives table state from session facts", () => {
  assert.equal(computeStatus(null), "free");
  assert.equal(computeStatus({ requests: [], billLines: [] } as never), "occupied");
  assert.equal(
    computeStatus({
      requests: [{ type: "waiter", resolvedAt: null }],
      billLines: [],
    } as never),
    "waiting",
  );
  assert.equal(
    computeStatus({
      requests: [{ type: "bill", resolvedAt: null }],
      billLines: [{ id: "line-1" }],
    } as never),
    "bill",
  );
  assert.equal(
    computeStatus({
      requests: [],
      billLines: [{ id: "line-2" }],
    } as never),
    "ordered",
  );
});

test("asFloorPlan keeps zoneId on tables", () => {
  const floorPlan = asFloorPlan({
    tables: [
      {
        tableId: 1,
        label: "Стол 1",
        zoneId: "zone-a",
        x: 12,
        y: 18,
        shape: "round",
        sizePreset: "lg",
      },
    ],
    zones: [{ id: "zone-a", label: "Основной зал", x: 0, y: 0, width: 50, height: 50 }],
  });

  assert.equal(floorPlan.tables[0]?.zoneId, "zone-a");
});
