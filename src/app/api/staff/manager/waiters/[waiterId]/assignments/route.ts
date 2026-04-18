import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { replaceManagerWaiterAssignments } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ waiterId: string }> },
) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json();
    const { waiterId } = await params;
    return noStoreJson(
      await replaceManagerWaiterAssignments({
        managerId: session.userId,
        waiterId,
        payload: {
          tableIds: Array.isArray(body.tableIds) ? body.tableIds.map(Number).filter(Number.isInteger) : [],
        },
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
