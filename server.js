const { execFileSync } = require('child_process');
const http = require('http');
const path = require('path');
const Module = require('module');
const { loadEnvConfig } = require('@next/env');

const projectNodeModules = path.join(__dirname, 'node_modules');
process.env.NODE_PATH = process.env.NODE_PATH
    ? `${projectNodeModules}${path.delimiter}${process.env.NODE_PATH}`
    : projectNodeModules;
Module._initPaths();

const next = require('next');

loadEnvConfig(__dirname, process.env.NODE_ENV !== 'production');

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';
const dev = process.env.NODE_ENV !== 'production';
const nodeCommand = process.execPath;

process.on('unhandledRejection', (error) => {
    console.error('[startup] Unhandled rejection');
    console.error(error);
});

process.on('uncaughtException', (error) => {
    console.error('[startup] Uncaught exception');
    console.error(error);
    process.exit(1);
});

function runCommand(label, args) {
    console.log(`[startup] ${label}`);
    execFileSync(nodeCommand, args, {
        cwd: __dirname,
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_PATH: process.env.NODE_PATH,
        },
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

    runCommand('Applying database bootstrap', ['scripts/bootstrap-db.cjs']);

    if (process.env.GIOTTO_SEED_ON_BOOT !== '0') {
        runCommand('Seeding initial data', ['scripts/prisma-cli.cjs', 'db', 'seed']);
    }
}

async function main() {
    console.log(`[startup] Booting Giotto in ${dev ? 'development' : 'production'} mode`);
    prepareDatabase();

    console.log('[startup] Creating Next application');
    const app = next({ dev, hostname: host, port });
    const handle = app.getRequestHandler();

    console.log('[startup] Preparing Next application');
    await app.prepare();
    console.log('[startup] Next application prepared');

    const server = http.createServer((req, res) => handle(req, res));
    server.on('error', (error) => {
        console.error('[startup] HTTP server error');
        console.error(error);
        process.exit(1);
    });

    server.listen(port, host, () => {
            console.log(`> Ready on http://${host}:${port}`);
        });
}

main().catch((error) => {
    console.error('[startup] Failed to boot application');
    console.error(error);
    process.exit(1);
});
