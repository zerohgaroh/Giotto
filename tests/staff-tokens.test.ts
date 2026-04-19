import assert from "node:assert/strict";
import test from "node:test";
import { hashOpaqueToken, issueAccessToken, issueRefreshToken, parseAccessToken, parseRefreshToken } from "../src/lib/staff-backend/tokens";

test("staff access tokens round-trip into a session payload", () => {
  const token = issueAccessToken({
    role: "waiter",
    userId: "w-marco",
    name: "Marco R.",
    sessionId: "session-1",
  });

  const parsed = parseAccessToken(token);

  assert.ok(parsed);
  assert.equal(parsed.role, "waiter");
  assert.equal(parsed.userId, "w-marco");
  assert.equal(parsed.name, "Marco R.");
  assert.equal(parsed.sessionId, "session-1");
  assert.ok(parsed.expiresAt > Date.now());
});

test("refresh tokens validate kind and signature", () => {
  const token = issueRefreshToken({
    role: "manager",
    userId: "m-giotto",
    name: "Giotto Manager",
    sessionId: "session-2",
  });

  const parsed = parseRefreshToken(token);
  const tampered = `${token.slice(0, -1)}x`;

  assert.ok(parsed);
  assert.equal(parsed.role, "manager");
  assert.equal(parsed.userId, "m-giotto");
  assert.equal(parsed.sessionId, "session-2");
  assert.equal(parseAccessToken(token), null);
  assert.equal(parseRefreshToken(tampered), null);
});

test("opaque token hashes are deterministic", () => {
  assert.equal(hashOpaqueToken("abc"), hashOpaqueToken("abc"));
  assert.notEqual(hashOpaqueToken("abc"), hashOpaqueToken("abd"));
});
