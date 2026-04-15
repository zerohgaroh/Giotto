import { WAITER_SEED_ACCOUNTS } from "./waiter-data";

export const WAITER_COOKIE = "giotto_waiter_session";

export function findWaiterByCredentials(login: string, password: string) {
  const normalizedLogin = login.trim().toLowerCase();
  return WAITER_SEED_ACCOUNTS.find(
    (account) =>
      account.active &&
      account.login.toLowerCase() === normalizedLogin &&
      account.password === password,
  );
}

export function findWaiterById(waiterId: string) {
  return WAITER_SEED_ACCOUNTS.find((account) => account.id === waiterId && account.active);
}
