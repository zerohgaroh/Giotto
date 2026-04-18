import { noStoreJson, toErrorResponse } from "@/lib/staff-backend/http";
import { getManagerLayout, updateManagerLayout } from "@/lib/staff-backend/manager";
import { requireManagerSession } from "@/lib/staff-backend/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireManagerSession(request);
    return noStoreJson(await getManagerLayout(session.userId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireManagerSession(request);
    const body = await request.json();
    return noStoreJson(
      await updateManagerLayout({
        managerId: session.userId,
        payload: {
          tables: Array.isArray(body.tables)
            ? body.tables.map((table: Record<string, unknown>) => ({
                tableId: Number(table.tableId),
                label: table.label ? String(table.label) : undefined,
                x: Number(table.x ?? 0),
                y: Number(table.y ?? 0),
                shape: table.shape === "round" || table.shape === "rect" ? table.shape : "square",
                sizePreset:
                  table.sizePreset === "sm" || table.sizePreset === "lg" ? table.sizePreset : "md",
              }))
            : [],
          zones: Array.isArray(body.zones)
            ? body.zones.map((zone: Record<string, unknown>) => ({
                id: String(zone.id ?? ""),
                label: String(zone.label ?? ""),
                x: Number(zone.x ?? 0),
                y: Number(zone.y ?? 0),
                width: Number(zone.width ?? 0),
                height: Number(zone.height ?? 0),
              }))
            : [],
        },
      }),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
