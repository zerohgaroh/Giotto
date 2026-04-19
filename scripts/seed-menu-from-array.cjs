const fs = require("fs");
const path = require("path");
const vm = require("vm");
const dotenv = require("dotenv");
const pg = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const rootDir = path.resolve(__dirname, "..");
const FALLBACK_MENU_IMAGE = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=85";

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

function asId(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  return normalized || fallback;
}

function asInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function normalizeText(value) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeImageUrl(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  return normalized.replace(/\/\s+/g, "/");
}

function ensureNoDuplicates(items, key, label) {
  const duplicates = items.filter((item, index) => items.findIndex((entry) => entry[key] === item[key]) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Найдены дублирующиеся ${label}: ${duplicates.map((item) => item[key]).join(", ")}`);
  }
}

function loadLegacyMenuPayload(sourceFilePath) {
  const absolutePath = path.resolve(rootDir, sourceFilePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  const sandbox = { window: {} };

  vm.runInNewContext(source, sandbox, { filename: absolutePath });

  if (!Array.isArray(sandbox.array)) {
    throw new Error(`Не удалось найти массив категорий в ${absolutePath}`);
  }

  if (!Array.isArray(sandbox.window.GIOTTO_MENU_ITEMS)) {
    throw new Error(`Не удалось найти window.GIOTTO_MENU_ITEMS в ${absolutePath}`);
  }

  return {
    absolutePath,
    categories: sandbox.array,
    items: sandbox.window.GIOTTO_MENU_ITEMS,
  };
}

async function main() {
  loadEnvFiles();

  const arrayArg = process.argv.find((arg) => arg.startsWith("--array-file="));
  const sourceFilePath = arrayArg ? arrayArg.slice("--array-file=".length) : "array.js";
  const payload = loadLegacyMenuPayload(sourceFilePath);

  const categories = payload.categories
    .map((category, index) => ({
      id: asId(category.id, `legacy-category-${index + 1}`),
      labelRu: normalizeText(category.ru) || normalizeText(category.uz) || normalizeText(category.en) || `Категория ${index + 1}`,
      icon: normalizeImageUrl(category.image) || null,
      sortOrder: asInt(category.sort_order, index),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  ensureNoDuplicates(categories, "id", "category id");

  const categoryIds = new Set(categories.map((category) => category.id));
  const categoryIcons = new Map(categories.map((category) => [category.id, category.icon ?? ""]));

  const dishes = payload.items.map((item, index) => {
    const id = asId(item.id, `legacy-dish-${index + 1}`);
    const categoryId = asId(item.category_id, "");
    if (!categoryIds.has(categoryId)) {
      throw new Error(`У блюда ${id} указана отсутствующая категория: ${categoryId}`);
    }

    const nameRu = normalizeText(item.ru) || normalizeText(item.uz) || normalizeText(item.en) || `Блюдо ${index + 1}`;
    const nameIt = normalizeText(item.en) || normalizeText(item.uz) || nameRu;
    const description =
      normalizeText(item.description_ru) ||
      normalizeText(item.description_uz) ||
      normalizeText(item.description_en);

    return {
      id,
      categoryId,
      nameIt,
      nameRu,
      description,
      price: asInt(item.price, 0),
      image: normalizeImageUrl(item.image) || categoryIcons.get(categoryId) || FALLBACK_MENU_IMAGE,
      portion: "1 порция",
      energyKcal: 0,
      badgeLabel: null,
      badgeTone: null,
      highlight: false,
      available: true,
      sortOrder: index,
    };
  });

  ensureNoDuplicates(dishes, "id", "dish id");

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.dish.deleteMany();
      await tx.menuCategory.deleteMany();

      if (categories.length > 0) {
        await tx.menuCategory.createMany({ data: categories });
      }

      if (dishes.length > 0) {
        await tx.dish.createMany({ data: dishes });
      }
    });

    console.log(
      `[seed-menu] Меню импортировано из ${payload.absolutePath}: ${categories.length} категорий, ${dishes.length} блюд.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
