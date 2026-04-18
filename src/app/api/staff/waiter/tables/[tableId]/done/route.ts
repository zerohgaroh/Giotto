import { markWaiterDone } from "@/lib/staff-backend/waiter";
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
    const data = await markWaiterDone({
      waiterId: session.userId,
      tableId: Number(params.tableId),
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
