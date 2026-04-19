const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const releaseDir = path.join(rootDir, "release", "hosting");

const entriesToCopy = [
  ".next",
  "public",
  "prisma",
  "scripts",
  "src",
  ".env.production",
  "server.js",
  "package.json",
  "package-lock.json",
  "next.config.mjs",
  "tsconfig.json",
  "next-env.d.ts",
];

function removeDir(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function copyEntry(relativePath) {
  const source = path.join(rootDir, relativePath);
  const target = path.join(releaseDir, relativePath);

  fs.cpSync(source, target, {
    recursive: true,
    force: true,
    filter: (src) => {
      const normalized = src.split(path.sep).join("/");
      if (normalized.includes("/.next/cache")) {
        return false;
      }
      if (normalized.endsWith("/.next/cache")) {
        return false;
      }
      return true;
    },
  });
}

function writeInstructions() {
  const content = [
    "Upload all contents of this folder to the hosting app root.",
    "",
    "Then run on the server:",
    "1. npm install",
    "2. node server.js",
    "",
    "Do not run next build on the server.",
    "Environment is loaded from .env.production.",
  ].join("\n");

  fs.writeFileSync(path.join(releaseDir, "UPLOAD-TO-HOSTING.txt"), content, "utf8");
}

function main() {
  removeDir(releaseDir);
  ensureDir(releaseDir);

  for (const entry of entriesToCopy) {
    copyEntry(entry);
  }

  writeInstructions();
  console.log(`[bundle] Hosting bundle created at ${releaseDir}`);
}

main();
