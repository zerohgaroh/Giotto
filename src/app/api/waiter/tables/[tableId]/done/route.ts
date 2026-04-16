import { markWaiterDone } from "@/lib/waiter-backend/backend";
import { noStoreJson, toErrorResponse } from "@/lib/waiter-backend/http";
import { requireWaiterSession } from "@/lib/waiter-backend/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function POST(_: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession();
    const data = await markWaiterDone({
      waiterId: session.waiterId,
      tableId: params.tableId,
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
