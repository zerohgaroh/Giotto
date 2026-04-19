const { execFileSync } = require('child_process');
const http = require('http');
const next = require('next');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(__dirname, process.env.NODE_ENV !== 'production');

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';
const dev = process.env.NODE_ENV !== 'production';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function runCommand(label, args) {
    console.log(`[startup] ${label}`);
    execFileSync(npxCommand, args, {
        cwd: __dirname,
        stdio: 'inherit',
        env: process.env,
    });
}

function prepareDatabase() {
    if (dev) {
        return;
    }

    if (process.env.GIOTTO_AUTO_PREPARE_DB === '0') {
        console.log('[startup] Database auto-prepare is disabled');
        return;
    }

    if (!process.env.DATABASE_URL) {
        console.warn('[startup] DATABASE_URL is missing, skipping Prisma bootstrap');
        return;
    }

    runCommand('Applying Prisma migrations', ['prisma', 'migrate', 'deploy']);

    if (process.env.GIOTTO_SEED_ON_BOOT !== '0') {
        runCommand('Seeding initial data', ['prisma', 'db', 'seed']);
    }
}

async function main() {
    prepareDatabase();

    const app = next({ dev, hostname: host, port });
    const handle = app.getRequestHandler();

    await app.prepare();

    http
        .createServer((req, res) => handle(req, res))
        .listen(port, host, () => {
            console.log(`> Ready on http://${host}:${port}`);
        });
}

main().catch((error) => {
    console.error('[startup] Failed to boot application');
    console.error(error);
    process.exit(1);
});
