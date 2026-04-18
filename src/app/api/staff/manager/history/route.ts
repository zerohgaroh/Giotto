import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { getManagerHistory } from "@/lib/staff-backend/manager";
import { parseOptionalInt } from "@/lib/staff-backend/route-parsers";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireManagerSession(request);
    const { searchParams } = new URL(request.url);
    return noStoreJson(
      await getManagerHistory({
        managerId: session.userId,
        tableId: parseOptionalInt(searchParams.get("tableId")),
        waiterId: searchParams.get("waiterId") || undefined,
        type: searchParams.get("type") || undefined,
        cursor: searchParams.get("cursor") || undefined,
        limit: parseOptionalInt(searchParams.get("limit"), 25),
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

