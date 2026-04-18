import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { createManagerMenuCategory } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json();
    return noStoreJson(
      await createManagerMenuCategory({
        managerId: session.userId,
        payload: {
          labelRu: String(body.labelRu ?? ""),
          icon: body.icon ? String(body.icon) : undefined,
          ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
        },
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

