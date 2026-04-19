const { execFileSync } = require('child_process');
const path = require('path');
const { cleanBuildDirs } = require('./clean.cjs');

const rootDir = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const nextBin = require.resolve('next/dist/bin/next', { paths: [rootDir] });
const buildEnv = {
  ...process.env,
  CI: process.env.CI || '1',
  TOKIO_WORKER_THREADS: process.env.TOKIO_WORKER_THREADS || '1',
  RAYON_NUM_THREADS: process.env.RAYON_NUM_THREADS || '1',
};

cleanBuildDirs();

execFileSync(process.execPath, [nextBin, 'build'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: buildEnv,
});
