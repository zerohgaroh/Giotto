import { getWaiterTableDetail } from "@/lib/waiter-backend/backend";
import { noStoreJson, toErrorResponse } from "@/lib/waiter-backend/http";
import { requireWaiterSession } from "@/lib/waiter-backend/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function GET(_: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession();
    const data = await getWaiterTableDetail(session.waiterId, params.tableId);
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
