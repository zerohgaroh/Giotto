import { acknowledgeWaiterRequest } from "@/lib/staff-backend/waiter";
import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireWaiterSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession(request);
    const body = (await request.json().catch(() => ({}))) as { requestId?: string };
    const data = await acknowledgeWaiterRequest({
      waiterId: session.userId,
      tableId: Number(params.tableId),
      requestId: body.requestId,
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
