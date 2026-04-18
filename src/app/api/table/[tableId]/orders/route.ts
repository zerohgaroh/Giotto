import { submitGuestOrder } from "@/lib/staff-backend/guest";
import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import type { WaiterOrderInput } from "@/lib/staff-backend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function POST(request: Request, { params }: Params) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      items?: WaiterOrderInput[];
    };

    const response = await submitGuestOrder({
      tableId: Number(params.tableId),
      items: Array.isArray(body.items) ? body.items : [],
    });

    return noStoreJson(response);
  } catch (error) {
    return toErrorResponse(error);
  }
}
