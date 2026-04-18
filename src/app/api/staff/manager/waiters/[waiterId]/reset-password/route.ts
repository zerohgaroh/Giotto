import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { resetManagerWaiterPassword } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ waiterId: string }> },
) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json();
    const { waiterId } = await params;
    return noStoreJson(
      await resetManagerWaiterPassword({
        managerId: session.userId,
        waiterId,
        payload: {
          password: String(body.password ?? ""),
        },
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

