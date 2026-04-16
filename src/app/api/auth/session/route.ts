import { cookies } from "next/headers";
import { MANAGER_COOKIE, parseManagerToken } from "@/lib/manager-auth";
import { findManagerById } from "@/lib/waiter-backend/backend";
import { getWaiterSessionFromCookies } from "@/lib/waiter-backend/session";
import { noStoreJson } from "@/lib/waiter-backend/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const waiterSession = await getWaiterSessionFromCookies();
  if (waiterSession) {
    return noStoreJson({ session: waiterSession });
  }

  const managerToken = cookies().get(MANAGER_COOKIE)?.value;
  const managerSession = parseManagerToken(managerToken);
  if (!managerSession) {
    return noStoreJson({ session: null });
  }

  const manager = await findManagerById(managerSession.managerId);
  if (!manager) {
    return noStoreJson({ session: null });
  }

  return noStoreJson({ session: managerSession });
}
