export type ManagerSeedAccount = {
  id: string;
  name: string;
  login: string;
  password: string;
  active: boolean;
};

export const MANAGER_SEED_ACCOUNTS: ManagerSeedAccount[] = [
  {
    id: "m-giotto",
    name: "Giotto Manager",
    login: "manager",
    password: "manager123",
    active: true,
  },
];
