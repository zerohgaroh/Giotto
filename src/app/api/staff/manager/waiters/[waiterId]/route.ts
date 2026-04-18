import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { getManagerWaiterDetail, updateManagerWaiter } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ waiterId: string }> },
) {
  try {
    const session = await requireManagerSession(request);
    const { waiterId } = await params;
    return noStoreJson(await getManagerWaiterDetail(session.userId, waiterId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ waiterId: string }> },
) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json();
    const { waiterId } = await params;
    return noStoreJson(
      await updateManagerWaiter({
        managerId: session.userId,
        waiterId,
        payload: {
          ...(body.name !== undefined ? { name: String(body.name) } : {}),
          ...(body.login !== undefined ? { login: String(body.login) } : {}),
          ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
        },
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

