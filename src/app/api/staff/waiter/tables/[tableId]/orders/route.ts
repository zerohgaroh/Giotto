import { addWaiterOrder } from "@/lib/staff-backend/waiter";
import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireWaiterSession } from "@/lib/staff-backend/request-auth";
import type { WaiterOrderInput } from "@/lib/staff-backend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession(request);
    const body = (await request.json().catch(() => ({}))) as { items?: WaiterOrderInput[]; mutationKey?: string };
    const data = await addWaiterOrder({
      waiterId: session.userId,
      tableId: Number(params.tableId),
      items: Array.isArray(body.items) ? body.items : [],
      mutationKey: typeof body.mutationKey === "string" ? body.mutationKey : undefined,
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
