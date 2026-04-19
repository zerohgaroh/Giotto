const { execFileSync } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
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
