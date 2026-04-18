import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { toggleManagerDishAvailability } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dishId: string }> },
) {
  try {
    const session = await requireManagerSession(request);
    const { dishId } = await params;
    return noStoreJson(
      await toggleManagerDishAvailability({
        managerId: session.userId,
        dishId,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

