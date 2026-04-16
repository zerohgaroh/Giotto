import { cookies } from "next/headers";
import { MANAGER_COOKIE } from "@/lib/manager-auth";
import { WAITER_COOKIE } from "@/lib/waiter-auth";
import { noStoreJson } from "@/lib/waiter-backend/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  cookies().delete(WAITER_COOKIE);
  cookies().delete(MANAGER_COOKIE);
  return noStoreJson({ ok: true });
}
