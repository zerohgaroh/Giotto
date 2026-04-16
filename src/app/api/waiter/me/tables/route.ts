import { getWaiterTables } from "@/lib/waiter-backend/backend";
import { noStoreJson, toErrorResponse } from "@/lib/waiter-backend/http";
import { requireWaiterSession } from "@/lib/waiter-backend/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireWaiterSession();
    const data = await getWaiterTables(session.waiterId);
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
