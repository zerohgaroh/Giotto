import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireWaiterSession } from "@/lib/staff-backend/request-auth";
import { repeatLastWaiterOrder } from "@/lib/staff-backend/waiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession(request);
    const body = (await request.json().catch(() => ({}))) as {
      sourceSessionId?: string;
      mutationKey?: string;
    };
    const data = await repeatLastWaiterOrder({
      waiterId: session.userId,
      tableId: Number(params.tableId),
      payload: {
        sourceSessionId: typeof body.sourceSessionId === "string" ? body.sourceSessionId : undefined,
        mutationKey: typeof body.mutationKey === "string" ? body.mutationKey : undefined,
      },
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
