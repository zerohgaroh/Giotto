import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { deleteManagerMenuCategory, updateManagerMenuCategory } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json();
    const { categoryId } = await params;
    return noStoreJson(
      await updateManagerMenuCategory({
        managerId: session.userId,
        categoryId,
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  try {
    const session = await requireManagerSession(request);
    const { categoryId } = await params;
    return noStoreJson(
      await deleteManagerMenuCategory({
        managerId: session.userId,
        categoryId,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

