export type MenuCategoryId =
  | "all"
  | "antipasti"
  | "primi"
  | "dolci"
  | "bevande";

export type DishBadgeTone = "gold" | "navy" | "sage" | "blush";

export type Dish = {
  id: string;
  category: Exclude<MenuCategoryId, "all">;
  nameIt: string;
  nameRu: string;
  description: string;
  price: number;
  image: string;
  portion: string;
  energyKcal: number;
  badgeLabel?: string;
  badgeTone?: DishBadgeTone;
  highlight?: boolean;
};
