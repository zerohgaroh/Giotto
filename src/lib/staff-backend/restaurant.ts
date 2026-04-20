import type { RestaurantData } from "../types";
import { prisma } from "./prisma";
import { ApiError } from "./projections";
import { ensureStaffBackendReady } from "./seed";

export type RestaurantProfileInput = {
  name?: string;
  subtitle?: string;
  description?: string;
  logo?: string;
  banner?: string;
  wifiName?: string;
  wifiPassword?: string;
};

export async function getRestaurantData(): Promise<RestaurantData> {
  await ensureStaffBackendReady();

  const [profile, categories, dishes] = await Promise.all([
    prisma.restaurantProfile.findUnique({ where: { id: 1 } }),
    prisma.menuCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.dish.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);

  if (!profile) {
    throw new ApiError(500, "Профиль ресторана не инициализирован");
  }

  return {
    profile: {
      name: profile.name,
      subtitle: profile.subtitle,
      description: profile.description,
      logo: profile.logo,
      banner: profile.banner,
      wifiName: profile.wifiName,
      wifiPassword: profile.wifiPassword,
    },
    categories: categories.map((category) => ({
      id: category.id,
      labelRu: category.labelRu,
      icon: category.icon ?? undefined,
    })),
    dishes: dishes.map((dish) => ({
      id: dish.id,
      category: dish.categoryId,
      nameIt: dish.nameIt,
      nameRu: dish.nameRu,
      description: dish.description,
      price: dish.price,
      image: dish.image,
      portion: dish.portion,
      energyKcal: dish.energyKcal,
      badgeLabel: dish.badgeLabel ?? undefined,
      badgeTone: dish.badgeTone as "gold" | "navy" | "sage" | "blush" | undefined,
      highlight: dish.highlight,
      available: dish.available,
    })),
  };
}

export async function updateRestaurantProfile(input: RestaurantProfileInput): Promise<RestaurantData> {
  await ensureStaffBackendReady();

  const normalize = (value: string | undefined) => (typeof value === "string" ? value.trim() : undefined);
  const data = {
    name: normalize(input.name),
    subtitle: normalize(input.subtitle),
    description: normalize(input.description),
    logo: normalize(input.logo),
    banner: normalize(input.banner),
    wifiName: normalize(input.wifiName),
    wifiPassword: normalize(input.wifiPassword),
  };

  const next = {
    name: data.name,
    subtitle: data.subtitle,
    description: data.description,
    logo: data.logo,
    banner: data.banner,
    wifiName: data.wifiName,
    wifiPassword: data.wifiPassword,
  };

  if (!next.name || !next.subtitle || !next.description || !next.logo || !next.banner) {
    throw new ApiError(400, "Restaurant profile fields are incomplete");
  }

  await prisma.restaurantProfile.upsert({
    where: { id: 1 },
    update: next,
    create: {
      id: 1,
      name: next.name,
      subtitle: next.subtitle,
      description: next.description,
      logo: next.logo,
      banner: next.banner,
      wifiName: next.wifiName ?? "",
      wifiPassword: next.wifiPassword ?? "",
    },
  });

  return getRestaurantData();
}
