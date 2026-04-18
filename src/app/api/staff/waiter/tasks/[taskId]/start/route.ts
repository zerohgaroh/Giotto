import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireWaiterSession } from "@/lib/staff-backend/request-auth";
import { startWaiterTask } from "@/lib/staff-backend/waiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { taskId: string };
};

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireWaiterSession(request);
    const data = await startWaiterTask({
      waiterId: session.userId,
      taskId: params.taskId,
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
