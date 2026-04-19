const { execFileSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const dotenv = require("dotenv");

const rootDir = __dirname || process.cwd();
const port = parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";
const nodeCommand = process.execPath;

function loadEnvFiles() {
    const mode = process.env.NODE_ENV || "development";
    const candidates = [
        ".env",
        mode !== "test" ? ".env.local" : null,
        `.env.${mode}`,
        `.env.${mode}.local`,
    ].filter(Boolean);

    for (const filename of candidates) {
        const absolutePath = path.join(rootDir, filename);
        if (!fs.existsSync(absolutePath)) continue;
        dotenv.config({ path: absolutePath, override: true });
    }
}

process.on("unhandledRejection", (error) => {
    console.error("[startup] Unhandled rejection");
    console.error(error);
});

process.on("uncaughtException", (error) => {
    console.error("[startup] Uncaught exception");
    console.error(error);
    process.exit(1);
});

function runCommand(label, args) {
    console.log(`[startup] ${label}`);
    execFileSync(nodeCommand, args, {
        cwd: rootDir,
        stdio: "inherit",
        env: process.env,
    });
}

function prepareDatabase() {
    if (dev) {
        return;
    }

    if (process.env.GIOTTO_AUTO_PREPARE_DB === "0") {
        console.log("[startup] Database auto-prepare is disabled");
        return;
    }

    if (!process.env.DATABASE_URL) {
        console.warn("[startup] DATABASE_URL is missing, skipping Prisma bootstrap");
        return;
    }

    runCommand("Applying database bootstrap", ["scripts/bootstrap-db.cjs"]);

    if (process.env.GIOTTO_SEED_ON_BOOT !== "0") {
        runCommand("Seeding initial data", ["scripts/run-seed.cjs"]);
    }
}

async function main() {
    loadEnvFiles();

    console.log(`[startup] Booting Giotto in ${dev ? "development" : "production"} mode`);
    prepareDatabase();

    console.log("[startup] Creating Express application");
    const { createApp } = await import("./dist/src/server/app.js");
    const app = await createApp();
    console.log("[startup] Express application created");

    const server = http.createServer(app);
    server.on("error", (error) => {
        console.error("[startup] HTTP server error");
        console.error(error);
        process.exit(1);
    });

    server.listen(port, host, () => {
        console.log(`> Ready on http://${host}:${port}`);
    });
}

main().catch((error) => {
    console.error("[startup] Failed to boot application");
    console.error(error);
    process.exit(1);
});
