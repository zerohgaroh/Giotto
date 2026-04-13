export type MenuCategoryId = string;

export type MenuCategory = {
  id: MenuCategoryId;
  labelRu: string;
  icon?: string;
};

export type DishBadgeTone = "gold" | "navy" | "sage" | "blush";

export type Dish = {
  id: string;
  category: MenuCategoryId;
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
  available?: boolean;
};

export type RestaurantProfile = {
  name: string;
  subtitle: string;
  description: string;
  logo: string;
  banner: string;
  wifiName: string;
  wifiPassword: string;
};

export type RestaurantData = {
  profile: RestaurantProfile;
  categories: MenuCategory[];
  dishes: Dish[];
};
