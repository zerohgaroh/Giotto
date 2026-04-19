const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const rootDir = path.resolve(__dirname, "..");

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

const tsxCli = resolveTsxCli();
const seedFile = path.join(rootDir, "prisma", "seed.ts");

execFileSync(process.execPath, [tsxCli, seedFile, ...process.argv.slice(2)], {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env,
});
