import type { Dish, MenuCategoryId } from "./types";

export const MENU_CATEGORIES: {
  id: MenuCategoryId;
  labelRu: string;
}[] = [
  { id: "all", labelRu: "Все" },
  { id: "antipasti", labelRu: "Закуски" },
  { id: "primi", labelRu: "Паста" },
  { id: "dolci", labelRu: "Десерты" },
  { id: "bevande", labelRu: "Напитки" },
];

export const DISHES: Dish[] = [
  {
    id: "bruschetta",
    category: "antipasti",
    nameIt: "Bruschetta al pomodoro",
    nameRu: "Брускетта с томатами",
    description: "Домашний хлеб, томаты, базилик, оливковое масло.",
    price: 89000,
    portion: "180 г",
    energyKcal: 240,
    badgeLabel: "Antipasto",
    badgeTone: "navy",
    image:
      "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800&q=85",
  },
  {
    id: "burrata",
    category: "antipasti",
    nameIt: "Burrata",
    nameRu: "Буррата с черри",
    description: "Кремовая буррата, запечённые томаты, руккола.",
    price: 145000,
    portion: "240 г",
    energyKcal: 420,
    badgeLabel: "Шеф рекомендует",
    badgeTone: "gold",
    highlight: true,
    image:
      "https://images.unsplash.com/photo-1760023570385-ee484f7076b3?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&dl=felix-ramirez-Yw6fO5vewuw-unsplash.jpg&w=1200",
  },
  {
    id: "tagliatelle",
    category: "primi",
    nameIt: "Tagliatelle al tartufo",
    nameRu: "Тальятелле с трюфелем",
    description: "Свежая паста, сливочный соус, чёрный трюфель.",
    price: 198000,
    portion: "320 г",
    energyKcal: 650,
    badgeLabel: "Signature",
    badgeTone: "gold",
    highlight: true,
    image:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=85",
  },
  {
    id: "risotto",
    category: "primi",
    nameIt: "Risotto ai funghi",
    nameRu: "Ризотто с грибами",
    description: "Карнароли, белые грибы, белое вино, пармезан.",
    price: 132000,
    portion: "300 г",
    energyKcal: 480,
    badgeLabel: "Классика",
    badgeTone: "sage",
    image:
      "https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&dl=rob-wicks-qrleIV6KkfI-unsplash.jpg&w=1200",
  },
  {
    id: "tiramisu",
    category: "dolci",
    nameIt: "Tiramisù",
    nameRu: "Тирамису",
    description: "Маскарпоне, савоярди, эспрессо, какао.",
    price: 72000,
    portion: "170 г",
    energyKcal: 350,
    badgeLabel: "Dolce",
    badgeTone: "blush",
    image:
      "https://images.unsplash.com/photo-1560969617-715be4e54d97?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&dl=kyndall-ramirez-vyYN2TwjW9M-unsplash.jpg&w=1200",
  },
  {
    id: "panna",
    category: "dolci",
    nameIt: "Panna cotta",
    nameRu: "Панна-котта",
    description: "Ваниль, ягодный соус.",
    price: 64000,
    portion: "160 г",
    energyKcal: 290,
    badgeLabel: "Нежный вкус",
    badgeTone: "sage",
    image:
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&q=85",
  },
  {
    id: "espresso",
    category: "bevande",
    nameIt: "Espresso",
    nameRu: "Эспрессо",
    description: "Классический итальянский эспрессо.",
    price: 25000,
    portion: "40 мл",
    energyKcal: 8,
    badgeLabel: "Italia",
    badgeTone: "navy",
    image:
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=85",
  },
  {
    id: "aperol",
    category: "bevande",
    nameIt: "Aperol Spritz",
    nameRu: "Апероль шприц",
    description: "Aperol, Prosecco, содовая, апельсин.",
    price: 89000,
    portion: "250 мл",
    energyKcal: 190,
    badgeLabel: "Aperitivo",
    badgeTone: "blush",
    image:
      "https://images.unsplash.com/photo-1560512823-829485b8bf24?w=800&q=85",
  },
];

export function getDishById(id: string) {
  return DISHES.find((d) => d.id === id);
}
