const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const releaseDir = path.join(rootDir, "release", "hosting");

const entriesToCopy = [
  "public",
  "prisma",
  "scripts",
  "src",
  "views",
  ".env.production",
  "server.js",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tailwind.config.js",
  "postcss.config.js",
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
  });
}

function writeInstructions() {
  const content = [
    "Upload all contents of this folder to the hosting app root.",
    "",
    "Then run on the server:",
    "1. npm install",
    "2. npm run build:css",
    "3. npm run start:server",
    "",
    "This release no longer uses Next.js.",
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
