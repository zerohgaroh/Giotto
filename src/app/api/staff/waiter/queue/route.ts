import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireWaiterSession } from "@/lib/staff-backend/request-auth";
import { getWaiterQueue } from "@/lib/staff-backend/waiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireWaiterSession(request);
    const data = await getWaiterQueue(session.userId);
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
