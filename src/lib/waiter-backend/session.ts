import { cookies } from "next/headers";
import { WAITER_COOKIE, parseWaiterToken } from "@/lib/waiter-auth";
import { findWaiterById } from "./backend";
import type { WaiterAuthSession } from "./types";

export async function getWaiterSessionFromCookies(): Promise<WaiterAuthSession | null> {
  const token = cookies().get(WAITER_COOKIE)?.value;
  const session = parseWaiterToken(token);
  if (!session) return null;

  const waiter = await findWaiterById(session.waiterId);
  if (!waiter) return null;

  return session;
}

export async function requireWaiterSession(): Promise<WaiterAuthSession> {
  const session = await getWaiterSessionFromCookies();
  if (!session) {
    throw new Error("UNAUTHORIZED_WAITER");
  }
  return session;
}
