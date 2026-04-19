const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const rootDir = path.resolve(__dirname, "..");
const migrationPath = path.join(rootDir, "prisma", "migrations", "20260417_baseline", "migration.sql");
const advisoryLockKey = "giotto_schema_bootstrap_v1";

function requireDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[db:bootstrap] DATABASE_URL is required");
    process.exit(1);
  }
  return connectionString;
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists
    `,
    [tableName],
  );

  return Boolean(result.rows[0]?.exists);
}

async function bootstrap() {
  const connectionString = requireDatabaseUrl();
  const sql = fs.readFileSync(migrationPath, "utf8");
  const client = new Client({ connectionString });

  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [advisoryLockKey]);

    const staffUserExists = await tableExists(client, "StaffUser");
    const restaurantProfileExists = await tableExists(client, "RestaurantProfile");

    if (staffUserExists && restaurantProfileExists) {
      console.log("[db:bootstrap] schema already exists, skipping baseline SQL");
      return;
    }

    console.log("[db:bootstrap] applying baseline SQL");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
      console.log("[db:bootstrap] baseline SQL applied");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [advisoryLockKey]);
    } catch {
      // Ignore unlock failures during shutdown.
    }
    await client.end();
  }
}

bootstrap().catch((error) => {
  console.error("[db:bootstrap] failed");
  console.error(error);
  process.exit(1);
});
