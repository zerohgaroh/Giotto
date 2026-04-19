import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { saveManagerMenuImage, readManagerMenuImage } from "../src/lib/staff-backend/menu-images";

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sWwaP8AAAAASUVORK5CYII=",
  "base64",
);

test("saveManagerMenuImage stores file and returns public metadata", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "giotto-menu-images-"));
  process.env.GIOTTO_UPLOADS_DIR = tempRoot;
  process.env.GIOTTO_PUBLIC_BASE_URL = "http://localhost:3000";

  const file = new File([ONE_BY_ONE_PNG], "tiny.png", { type: "image/png" });
  const response = await saveManagerMenuImage(file, new Request("http://localhost:3000/api/staff/manager/menu/images"));

  assert.equal(response.mimeType, "image/png");
  assert.equal(response.width, 1);
  assert.equal(response.height, 1);
  assert.equal(response.sizeBytes, ONE_BY_ONE_PNG.length);
  assert.match(response.url, /\/api\/uploads\/menu\/.+\.png$/);
});

test("readManagerMenuImage returns stored bytes and mime type", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "giotto-menu-images-read-"));
  process.env.GIOTTO_UPLOADS_DIR = tempRoot;
  process.env.GIOTTO_PUBLIC_BASE_URL = "http://localhost:3000";

  const file = new File([ONE_BY_ONE_PNG], "tiny.png", { type: "image/png" });
  const saved = await saveManagerMenuImage(file, new Request("http://localhost:3000/api/staff/manager/menu/images"));
  const filename = saved.url.split("/").pop() ?? "";

  const loaded = await readManagerMenuImage(filename);
  assert.equal(loaded.mimeType, "image/png");
  assert.equal(Buffer.compare(Buffer.from(loaded.body), ONE_BY_ONE_PNG), 0);
});
