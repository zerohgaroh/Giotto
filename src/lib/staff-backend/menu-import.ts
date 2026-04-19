import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { prisma } from "./prisma";

type LegacyCategory = {
  id: string | number;
  ru?: string;
  uz?: string;
  en?: string;
  image?: string;
  parent_id?: string | number | null;
  is_active?: string | number | boolean;
  sort_order?: string | number;
};

type LegacyMenuItem = {
  id: string | number;
  category_id?: string | number;
  ru?: string;
  uz?: string;
  en?: string;
  price?: string | number;
  image?: string;
  description_ru?: string;
  description_uz?: string;
  description_en?: string;
};

type LegacyMenuPayload = {
  categories: LegacyCategory[];
  items: LegacyMenuItem[];
};

const FALLBACK_MENU_IMAGE = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=85";

function asId(value: string | number | null | undefined, fallback: string) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  return normalized || fallback;
}

function asInt(value: string | number | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeImageUrl(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  return normalized.replace(/\/\s+/g, "/");
}

async function loadLegacyMenuPayload(filePath: string): Promise<LegacyMenuPayload> {
  const absolutePath = path.resolve(filePath);
  const source = await readFile(absolutePath, "utf8");
  const sandbox: { array?: unknown; window: { GIOTTO_MENU_ITEMS?: unknown } } = { window: {} };

  vm.runInNewContext(source, sandbox, { filename: absolutePath });

  if (!Array.isArray(sandbox.array)) {
    throw new Error(`Не удалось найти массив категорий в ${absolutePath}`);
  }

  if (!Array.isArray(sandbox.window.GIOTTO_MENU_ITEMS)) {
    throw new Error(`Не удалось найти window.GIOTTO_MENU_ITEMS в ${absolutePath}`);
  }

  return {
    categories: sandbox.array as LegacyCategory[],
    items: sandbox.window.GIOTTO_MENU_ITEMS as LegacyMenuItem[],
  };
}

export async function replaceMenuFromLegacyArray(sourceFilePath = "array.js") {
  const payload = await loadLegacyMenuPayload(sourceFilePath);

  const categories = payload.categories
    .map((category, index) => ({
      id: asId(category.id, `legacy-category-${index + 1}`),
      labelRu: normalizeText(category.ru) || normalizeText(category.uz) || normalizeText(category.en) || `Категория ${index + 1}`,
      icon: normalizeImageUrl(category.image) || null,
      sortOrder: asInt(category.sort_order, index),
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  const duplicateCategoryIds = categories.filter(
    (category, index) => categories.findIndex((entry) => entry.id === category.id) !== index,
  );
  if (duplicateCategoryIds.length > 0) {
    throw new Error(`Найдены дублирующиеся category id: ${duplicateCategoryIds.map((entry) => entry.id).join(", ")}`);
  }

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
      nameRu,
      nameIt,
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

  const duplicateDishIds = dishes.filter((dish, index) => dishes.findIndex((entry) => entry.id === dish.id) !== index);
  if (duplicateDishIds.length > 0) {
    throw new Error(`Найдены дублирующиеся dish id: ${duplicateDishIds.map((entry) => entry.id).join(", ")}`);
  }

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

  return {
    sourceFilePath: path.resolve(sourceFilePath),
    categoriesCount: categories.length,
    dishesCount: dishes.length,
  };
}
