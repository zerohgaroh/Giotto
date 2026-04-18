import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { archiveManagerTable } from "@/lib/staff-backend/manager";
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
    const { tableId } = await params;
    return noStoreJson(
      await archiveManagerTable({
        managerId: session.userId,
        tableId: parseTableId(tableId),
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

