const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const rootDir = path.resolve(__dirname, "..");
const compiledSeedFile = path.join(rootDir, "dist", "prisma", "seed.js");

function loadEnvFiles() {
  const mode = process.env.NODE_ENV || "development";
  const candidates = [
    ".env",
    mode !== "test" ? ".env.local" : null,
    `.env.${mode}`,
    `.env.${mode}.local`,
  ].filter(Boolean);

  for (const filename of candidates) {
    const absolutePath = path.join(rootDir, filename);
    if (!fs.existsSync(absolutePath)) continue;
    dotenv.config({ path: absolutePath, override: true });
  }
}

loadEnvFiles();

function resolveTsxCli() {
  try {
    return require.resolve("tsx/cli", { paths: [rootDir] });
  } catch {
    const tsxPackageJson = require.resolve("tsx/package.json", { paths: [rootDir] });
    return path.join(path.dirname(tsxPackageJson), "dist", "cli.mjs");
  }
}

const seedArgs = process.argv.slice(2);
const commandArgs = fs.existsSync(compiledSeedFile)
  ? [compiledSeedFile, ...seedArgs]
  : [resolveTsxCli(), path.join(rootDir, "prisma", "seed.ts"), ...seedArgs];

execFileSync(process.execPath, commandArgs, {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env,
});
