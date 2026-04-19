const { execFileSync } = require("child_process");
const path = require("path");
const { cleanBuildDirs } = require("./clean.cjs");

const rootDir = __dirname ? path.resolve(__dirname, "..") : process.cwd();
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const buildEnv = {
  ...process.env,
  CI: process.env.CI || "1",
};

cleanBuildDirs();

execFileSync(npmBin, ["run", "build"], {
  cwd: rootDir,
  stdio: "inherit",
  env: buildEnv,
});
