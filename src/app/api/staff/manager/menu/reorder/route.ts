import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { reorderManagerMenu } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json().catch(() => ({}));
    return noStoreJson(
      await reorderManagerMenu({
        managerId: session.userId,
        categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds.map(String) : undefined,
        dishIdsByCategory:
          body.dishIdsByCategory && typeof body.dishIdsByCategory === "object"
            ? Object.fromEntries(
                Object.entries(body.dishIdsByCategory).map(([key, value]) => [
                  key,
                  Array.isArray(value) ? value.map(String) : [],
                ]),
              )
            : undefined,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

