import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireWaiterSession } from "@/lib/staff-backend/request-auth";
import { completeWaiterTask } from "@/lib/staff-backend/waiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { taskId: string };
};

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession(request);
    const body = (await request.json().catch(() => ({}))) as { mutationKey?: string };
    const data = await completeWaiterTask({
      waiterId: session.userId,
      taskId: params.taskId,
      mutationKey: typeof body.mutationKey === "string" ? body.mutationKey : undefined,
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
