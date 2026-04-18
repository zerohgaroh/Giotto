import { getHallProjection } from "@/lib/staff-backend/projections";
import { noStoreJson } from "@/lib/staff-backend/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return noStoreJson(await getHallProjection());
}

export async function PUT() {
  return noStoreJson(
    {
      error: "Hall mutation from web dashboard is deprecated in waiter v1.",
    },
    501,
  );
}
