import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { requireWaiterSession } from "@/lib/staff-backend/request-auth";
import { getWaiterShortcuts, updateWaiterShortcuts } from "@/lib/staff-backend/waiter";
import type { WaiterShortcuts } from "@/lib/staff-backend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireWaiterSession(request);
    const data = await getWaiterShortcuts(session.userId);
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireWaiterSession(request);
    const body = (await request.json().catch(() => ({}))) as Partial<WaiterShortcuts>;
    const data = await updateWaiterShortcuts({
      waiterId: session.userId,
      payload: {
        favoriteDishIds: Array.isArray(body.favoriteDishIds) ? body.favoriteDishIds : [],
        noteTemplates: Array.isArray(body.noteTemplates) ? body.noteTemplates : [],
        quickOrderPresets: Array.isArray(body.quickOrderPresets) ? body.quickOrderPresets : [],
      },
    });
    return noStoreJson(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
