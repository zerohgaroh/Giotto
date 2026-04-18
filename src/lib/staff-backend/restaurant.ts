import type { RestaurantData } from "@/lib/types";
import { prisma } from "./prisma";
import { ApiError } from "./projections";
import { ensureStaffBackendReady } from "./seed";

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
