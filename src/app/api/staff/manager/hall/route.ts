import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { getManagerHall } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireManagerSession(request);
    return noStoreJson(await getManagerHall(session.userId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

