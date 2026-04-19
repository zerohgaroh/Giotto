const { execFileSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const dotenv = require("dotenv");

const rootDir = fs.existsSync(path.join(__dirname, "package.json"))
    ? __dirname
    : path.resolve(__dirname, "..");
const port = parseInt(process.env.PORT || "5000", 10);
const host = process.env.HOST || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";
const nodeCommand = process.execPath;

function resolveAppModulePath() {
    const sourceAppPath = path.join(rootDir, "src", "server", "app.ts");
    const compiledAppPath = path.join(rootDir, "dist", "src", "server", "app.js");

    // In development always prefer source files so hot-reloads pick up latest edits.
    if (dev && fs.existsSync(sourceAppPath)) {
        return path.relative(__dirname, sourceAppPath).replace(/\\/g, "/").replace(/^[^./]/, "./$&");
    }

    if (fs.existsSync(compiledAppPath)) {
        return path.relative(__dirname, compiledAppPath).replace(/\\/g, "/").replace(/^[^./]/, "./$&");
    }

    if (fs.existsSync(sourceAppPath)) {
        return path.relative(__dirname, sourceAppPath).replace(/\\/g, "/").replace(/^[^./]/, "./$&");
    }

    throw new Error(
        `Unable to find application entrypoint. Checked ${compiledAppPath} and ${sourceAppPath}.`
    );
}

function loadEnvFiles() {
    const mode = process.env.NODE_ENV || "development";
    const protectedKeys = new Set(Object.keys(process.env));
    const candidates = [
        ".env",
        mode !== "test" ? ".env.local" : null,
        `.env.${mode}`,
        `.env.${mode}.local`,
    ].filter(Boolean);

    for (const filename of candidates) {
        const absolutePath = path.join(rootDir, filename);
        if (!fs.existsSync(absolutePath)) continue;
        const parsed = dotenv.parse(fs.readFileSync(absolutePath));
        for (const [key, value] of Object.entries(parsed)) {
            if (protectedKeys.has(key)) {
                continue;
            }

            process.env[key] = value;
        }
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
    const appModule = await import(resolveAppModulePath());
    const createApp =
        appModule.createApp ||
        (appModule.default && appModule.default.createApp) ||
        appModule.default;

    if (typeof createApp !== "function") {
        throw new TypeError("createApp export was not found in server app module");
    }

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
