import assert from "node:assert/strict";
import test from "node:test";
import { buildGuestTableLink, resolvePublicBaseUrl } from "../src/lib/staff-backend/public-url";

test("buildGuestTableLink returns stable paths and absolute url", () => {
  const link = buildGuestTableLink(12, { publicBaseUrl: "http://example.com/" });

  assert.equal(link.tableId, 12);
  assert.match(link.accessKey, /^[a-z0-9]{8,18}$/);
  assert.equal(link.shortPath, `/t/12/${link.accessKey}`);
  assert.equal(link.tablePath, "/table/12");
  assert.equal(link.menuPath, "/table/12/menu");
  assert.equal(link.waiterPath, "/table/12/waiter");
  assert.equal(link.url, `http://example.com/t/12/${link.accessKey}`);
});

test("resolvePublicBaseUrl falls back to request origin when env is absent", () => {
  const previous = process.env.GIOTTO_PUBLIC_BASE_URL;
  delete process.env.GIOTTO_PUBLIC_BASE_URL;

  try {
    const request = new Request("http://192.168.1.9:3000/api/staff/manager/hall");
    assert.equal(resolvePublicBaseUrl({ request }), "http://192.168.1.9:3000");
  } finally {
    if (previous) {
      process.env.GIOTTO_PUBLIC_BASE_URL = previous;
    }
  }
});
