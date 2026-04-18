import { setWaiterTableNote } from "@/lib/staff-backend/waiter";
import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireWaiterSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession(request);
    const body = (await request.json().catch(() => ({}))) as { note?: string };
    const data = await setWaiterTableNote({
      waiterId: session.userId,
      tableId: Number(params.tableId),
      note: String(body.note ?? ""),
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
