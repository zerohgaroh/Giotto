import { refreshStaffSession } from "@/lib/staff-backend/auth";
import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      refreshToken?: string;
    };

    const response = await refreshStaffSession(String(body.refreshToken ?? ""));
    return noStoreJson(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
