import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { reassignManagerTable } from "@/lib/staff-backend/manager";
import { parseTableId } from "@/lib/staff-backend/route-parsers";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json().catch(() => ({}));
    const { tableId } = await params;
    return noStoreJson(
      await reassignManagerTable({
        managerId: session.userId,
        tableId: parseTableId(tableId),
        waiterId: typeof body.waiterId === "string" && body.waiterId.trim() ? body.waiterId.trim() : undefined,
        publicBaseUrl: new URL(request.url).origin,
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
