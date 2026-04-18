import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { createManagerWaiter, listManagerWaiters } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireManagerSession(request);
    return noStoreJson(await listManagerWaiters(session.userId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json();
    return noStoreJson(
      await createManagerWaiter({
        managerId: session.userId,
        payload: {
          name: String(body.name ?? ""),
          login: String(body.login ?? ""),
          password: String(body.password ?? ""),
          tableIds: Array.isArray(body.tableIds) ? body.tableIds.map(Number).filter(Number.isInteger) : [],
        },
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

