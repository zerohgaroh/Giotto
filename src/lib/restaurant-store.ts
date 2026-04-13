"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_RESTAURANT_PROFILE, DISHES, MENU_CATEGORIES } from "@/lib/menu-data";
import type { Dish, RestaurantData } from "@/lib/types";

const STORAGE_KEY = "giotto.restaurant.data.v1";
const UPDATE_EVENT = "giotto:restaurant-data-updated";

const DEFAULT_DATA: RestaurantData = {
  profile: DEFAULT_RESTAURANT_PROFILE,
  categories: MENU_CATEGORIES,
  dishes: DISHES,
};

function normalizeData(input: unknown): RestaurantData {
  if (!input || typeof input !== "object") return DEFAULT_DATA;
  const raw = input as Partial<RestaurantData>;

  const categories = Array.isArray(raw.categories) && raw.categories.length > 0
    ? raw.categories.map((category) => ({
        id: String(category.id ?? ""),
        labelRu: String(category.labelRu ?? ""),
        icon: category.icon ? String(category.icon) : undefined,
      })).filter((category) => category.id && category.labelRu)
    : DEFAULT_DATA.categories;

  const dishes = Array.isArray(raw.dishes) && raw.dishes.length > 0
    ? raw.dishes.map((dish) => ({
        id: String(dish.id ?? ""),
        category: String(dish.category ?? ""),
        nameIt: String(dish.nameIt ?? ""),
        nameRu: String(dish.nameRu ?? ""),
        description: String(dish.description ?? ""),
        price: Number(dish.price ?? 0),
        image: String(dish.image ?? ""),
        portion: String(dish.portion ?? "—"),
        energyKcal: Number(dish.energyKcal ?? 0),
        badgeLabel: dish.badgeLabel ? String(dish.badgeLabel) : undefined,
        badgeTone: dish.badgeTone,
        highlight: Boolean(dish.highlight),
        available: dish.available !== false,
      })).filter((dish) => dish.id && dish.category && dish.nameRu)
    : DEFAULT_DATA.dishes;

  const profile = raw.profile && typeof raw.profile === "object"
    ? {
        name: String(raw.profile.name ?? DEFAULT_DATA.profile.name),
        subtitle: String(raw.profile.subtitle ?? DEFAULT_DATA.profile.subtitle),
        description: String(raw.profile.description ?? DEFAULT_DATA.profile.description),
        logo: String(raw.profile.logo ?? DEFAULT_DATA.profile.logo),
        banner: String(raw.profile.banner ?? DEFAULT_DATA.profile.banner),
        wifiName: String(raw.profile.wifiName ?? DEFAULT_DATA.profile.wifiName),
        wifiPassword: String(raw.profile.wifiPassword ?? DEFAULT_DATA.profile.wifiPassword),
      }
    : DEFAULT_DATA.profile;

  return { profile, categories, dishes };
}

export function readRestaurantData(): RestaurantData {
  if (typeof window === "undefined") return DEFAULT_DATA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    return normalizeData(JSON.parse(raw));
  } catch {
    return DEFAULT_DATA;
  }
}

export function writeRestaurantData(data: RestaurantData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

export function getDishByIdFromData(dishes: Dish[], dishId: string): Dish | undefined {
  return dishes.find((dish) => dish.id === dishId);
}

export function useRestaurantData() {
  const [data, setData] = useState<RestaurantData>(DEFAULT_DATA);

  useEffect(() => {
    setData(readRestaurantData());

    const sync = () => {
      setData(readRestaurantData());
    };

    window.addEventListener("storage", sync);
    window.addEventListener(UPDATE_EVENT, sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(UPDATE_EVENT, sync as EventListener);
    };
  }, []);

  const updateData = useCallback(
    (updater: (current: RestaurantData) => RestaurantData) => {
      const next = updater(readRestaurantData());
      writeRestaurantData(next);
      setData(next);
    },
    [],
  );

  const resetData = useCallback(() => {
    writeRestaurantData(DEFAULT_DATA);
    setData(DEFAULT_DATA);
  }, []);

  return useMemo(
    () => ({ data, updateData, resetData }),
    [data, resetData, updateData],
  );
}
