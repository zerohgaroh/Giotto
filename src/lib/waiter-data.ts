export type WaiterSeedAccount = {
  id: string;
  name: string;
  login: string;
  password: string;
  active: boolean;
  tableIds: number[];
};

export const WAITER_SEED_ACCOUNTS: WaiterSeedAccount[] = [
  {
    id: "w-marco",
    name: "Марко Р.",
    login: "marco",
    password: "waiter123",
    active: true,
    tableIds: [1, 2, 3, 5, 7],
  },
  {
    id: "w-luca",
    name: "Лука Ф.",
    login: "luca",
    password: "waiter123",
    active: true,
    tableIds: [4, 6, 8, 9, 10],
  },
];
