import { noStoreJson } from "@/lib/staff-backend/http";
import { getHallProjection } from "@/lib/staff-backend/projections";
import { resetStaffSeedData } from "@/lib/staff-backend/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await resetStaffSeedData();
  return noStoreJson(await getHallProjection());
}
