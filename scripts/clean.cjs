const fs = require('fs');
const path = require('path');

const rootDir = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const buildDirs = ['.next', '.next-dev', '.next-build', '.next-dev-3002', 'dist', path.join('release', 'hosting')];
const generatedFiles = [path.join('public', 'assets', 'app.css')];

function cleanBuildDirs() {
  for (const dir of buildDirs) {
    fs.rmSync(path.join(rootDir, dir), { recursive: true, force: true });
  }
  for (const file of generatedFiles) {
    fs.rmSync(path.join(rootDir, file), { force: true });
  }
}

if (require.main === module) {
  cleanBuildDirs();
}

module.exports = { cleanBuildDirs };
