import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { createManagerDish } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json();
    return noStoreJson(
      await createManagerDish({
        managerId: session.userId,
        payload: {
          categoryId: String(body.categoryId ?? ""),
          nameRu: String(body.nameRu ?? ""),
          nameIt: String(body.nameIt ?? ""),
          description: String(body.description ?? ""),
          price: Number(body.price ?? 0),
          image: String(body.image ?? ""),
          portion: String(body.portion ?? ""),
          energyKcal: Number(body.energyKcal ?? 0),
          ...(body.badgeLabel ? { badgeLabel: String(body.badgeLabel) } : {}),
          ...(body.badgeTone ? { badgeTone: body.badgeTone } : {}),
          ...(body.highlight !== undefined ? { highlight: Boolean(body.highlight) } : {}),
          available: body.available !== false,
        },
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
