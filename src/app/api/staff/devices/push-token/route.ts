import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireStaffSession } from "@/lib/staff-backend/request-auth";
import { registerPushDevice } from "@/lib/staff-backend/waiter";
import type { PushDeviceRegistration } from "@/lib/staff-backend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const body = (await request.json().catch(() => ({}))) as Partial<PushDeviceRegistration>;

    const response = await registerPushDevice(session, {
      token: String(body.token ?? ""),
      platform: (body.platform ?? "expo") as PushDeviceRegistration["platform"],
      appVersion: body.appVersion,
      deviceId: body.deviceId,
    });

    return noStoreJson(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
