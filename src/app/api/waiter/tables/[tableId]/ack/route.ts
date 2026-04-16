import { acknowledgeWaiterRequest } from "@/lib/waiter-backend/backend";
import { noStoreJson, toErrorResponse } from "@/lib/waiter-backend/http";
import { requireWaiterSession } from "@/lib/waiter-backend/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession();
    const body = (await request.json().catch(() => ({}))) as { requestId?: string };
    const data = await acknowledgeWaiterRequest({
      waiterId: session.waiterId,
      tableId: params.tableId,
      requestId: body.requestId,
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
