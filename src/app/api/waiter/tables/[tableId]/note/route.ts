import { setWaiterTableNote } from "@/lib/waiter-backend/backend";
import { noStoreJson, toErrorResponse } from "@/lib/waiter-backend/http";
import { requireWaiterSession } from "@/lib/waiter-backend/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession();
    const body = (await request.json().catch(() => ({}))) as { note?: string };
    const data = await setWaiterTableNote({
      waiterId: session.waiterId,
      tableId: params.tableId,
      note: String(body.note ?? ""),
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
