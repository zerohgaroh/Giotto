const { execFileSync } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const tsxCli = require.resolve("tsx/dist/cli.cjs", { paths: [rootDir] });
const seedFile = path.join(rootDir, "prisma", "seed.ts");

execFileSync(process.execPath, [tsxCli, seedFile, ...process.argv.slice(2)], {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env,
});
