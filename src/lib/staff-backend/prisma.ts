import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __giottoPrisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __giottoPrismaPool: pg.Pool | undefined;
}

const prismaPool =
  globalThis.__giottoPrismaPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

const adapter = new PrismaPg(prismaPool);

export const prisma =
  globalThis.__giottoPrisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__giottoPrisma = prisma;
  globalThis.__giottoPrismaPool = prismaPool;
}
