import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireWaiterSession } from "@/lib/staff-backend/request-auth";
import { getWaiterTableDetail } from "@/lib/staff-backend/waiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession(request);
    const data = await getWaiterTableDetail(session.userId, Number(params.tableId));
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
