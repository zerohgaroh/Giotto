import assert from "node:assert/strict";
import test from "node:test";
import { parseHistoryCursor, serializeHistoryCursor } from "../src/lib/staff-backend/activity";

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
