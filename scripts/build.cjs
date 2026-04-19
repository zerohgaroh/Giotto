const { execFileSync } = require('child_process');
const path = require('path');
const { cleanBuildDirs } = require('./clean.cjs');

const rootDir = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const nextBin = require.resolve('next/dist/bin/next', { paths: [rootDir] });

cleanBuildDirs();

execFileSync(process.execPath, [nextBin, 'build'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});
