import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireWaiterSession } from "@/lib/staff-backend/request-auth";
import { createWaiterFollowUpTask } from "@/lib/staff-backend/waiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession(request);
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      dueInMin?: number;
      note?: string;
    };
    const data = await createWaiterFollowUpTask({
      waiterId: session.userId,
      tableId: Number(params.tableId),
      title: String(body.title ?? ""),
      dueInMin: Number.isFinite(Number(body.dueInMin)) ? Number(body.dueInMin) : undefined,
      note: typeof body.note === "string" ? body.note : undefined,
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
