import { cookies } from "next/headers";
import { noStoreJson, toErrorResponse } from "@/lib/waiter-backend/http";
import {
  authenticateManagerCredentials,
  authenticateWaiterCredentials,
} from "@/lib/waiter-backend/backend";
import {
  MANAGER_COOKIE,
  issueManagerToken,
  managerCookieOptions,
} from "@/lib/manager-auth";
import { WAITER_COOKIE, issueWaiterToken, waiterCookieOptions } from "@/lib/waiter-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { login?: string; password?: string };
    const login = String(body.login ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!login || !password) {
      return noStoreJson({ error: "Нужны логин и пароль" }, 400);
    }

    const waiter = await authenticateWaiterCredentials(login, password);
    if (waiter) {
      const token = issueWaiterToken(waiter.id);
      cookies().set(WAITER_COOKIE, token, waiterCookieOptions());
      cookies().delete(MANAGER_COOKIE);

      return noStoreJson({
        session: {
          role: "waiter",
          waiterId: waiter.id,
        },
        waiter: {
          id: waiter.id,
          name: waiter.name,
        },
      });
    }

    const manager = await authenticateManagerCredentials(login, password);
    if (!manager) {
      return noStoreJson({ error: "Неверный логин или пароль" }, 401);
    }

    const token = issueManagerToken(manager.id);
    cookies().set(MANAGER_COOKIE, token, managerCookieOptions());
    cookies().delete(WAITER_COOKIE);

    return noStoreJson({
      session: {
        role: "manager",
        managerId: manager.id,
      },
      manager: {
        id: manager.id,
        name: manager.name,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
