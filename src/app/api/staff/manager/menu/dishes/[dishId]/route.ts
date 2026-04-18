import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { deleteManagerDish, updateManagerDish } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dishId: string }> },
) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json();
    const { dishId } = await params;
    return noStoreJson(
      await updateManagerDish({
        managerId: session.userId,
        dishId,
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ dishId: string }> },
) {
  try {
    const session = await requireManagerSession(request);
    const { dishId } = await params;
    return noStoreJson(
      await deleteManagerDish({
        managerId: session.userId,
        dishId,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

