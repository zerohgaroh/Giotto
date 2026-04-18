import { createGuestRequest, getGuestRequestCooldown } from "@/lib/staff-backend/guest";
import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import type { ServiceRequestType } from "@/lib/staff-backend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: { tableId: string };
};

function parseType(raw: string | null | undefined): ServiceRequestType {
  return raw === "bill" ? "bill" : "waiter";
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { searchParams } = new URL(request.url);
    const type = parseType(searchParams.get("type"));
    const cooldown = await getGuestRequestCooldown({ tableId: Number(params.tableId), type });
    return noStoreJson({ cooldown });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      type?: ServiceRequestType;
      reason?: string;
    };
    const type = parseType(body.type);

    const result = await createGuestRequest({
      tableId: Number(params.tableId),
      type,
      reason: body.reason,
    });

    return noStoreJson(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
