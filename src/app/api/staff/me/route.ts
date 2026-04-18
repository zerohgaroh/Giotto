import { getStaffBootstrap } from "@/lib/staff-backend/bootstrap";
import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireStaffSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const response = await getStaffBootstrap(session);
    return noStoreJson(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
