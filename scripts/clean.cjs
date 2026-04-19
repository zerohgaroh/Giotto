const fs = require('fs');
const path = require('path');

const rootDir = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const buildDirs = ['.next', '.next-dev', '.next-build', '.next-dev-3002'];

function cleanBuildDirs() {
  for (const dir of buildDirs) {
    fs.rmSync(path.join(rootDir, dir), { recursive: true, force: true });
  }
}

if (require.main === module) {
  cleanBuildDirs();
}

module.exports = { cleanBuildDirs };
