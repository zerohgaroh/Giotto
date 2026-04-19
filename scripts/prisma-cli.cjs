const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname ? path.resolve(__dirname, '..') : process.cwd();
const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
const passthroughCommands = new Set(['--version', '-v', 'version', 'debug', '--help', '-h', 'help']);

if (!fs.existsSync(schemaPath)) {
  console.error(`[prisma-cli] Prisma schema not found: ${schemaPath}`);
  process.exit(1);
}

const prismaBin = require.resolve('prisma/build/index.js', { paths: [rootDir] });
const nodeBin = process.execPath;
const cliArgs = process.argv.slice(2);
const needsSchema = !cliArgs.some((arg) => passthroughCommands.has(arg));
const args = needsSchema ? [prismaBin, ...cliArgs, '--schema', schemaPath] : [prismaBin, ...cliArgs];

execFileSync(nodeBin, args, {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});
