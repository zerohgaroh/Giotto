import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { createManagerTable } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json().catch(() => ({}));
    return noStoreJson(
      await createManagerTable({
        managerId: session.userId,
        payload: {
          ...(body.label ? { label: String(body.label) } : {}),
          ...(body.zoneId ? { zoneId: String(body.zoneId) } : {}),
          ...(body.shape ? { shape: body.shape } : {}),
          ...(body.sizePreset ? { sizePreset: body.sizePreset } : {}),
          ...(body.x !== undefined ? { x: Number(body.x) } : {}),
          ...(body.y !== undefined ? { y: Number(body.y) } : {}),
        },
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
