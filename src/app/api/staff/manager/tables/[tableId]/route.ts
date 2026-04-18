import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { getManagerTableDetail } from "@/lib/staff-backend/manager";
import { parseTableId } from "@/lib/staff-backend/route-parsers";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    const session = await requireManagerSession(request);
    const { tableId } = await params;
    return noStoreJson(await getManagerTableDetail(session.userId, parseTableId(tableId)));
  } catch (error) {
    return toErrorResponse(error);
  }
}

