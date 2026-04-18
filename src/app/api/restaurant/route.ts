import { noStoreJson } from "@/lib/staff-backend/http";
import { getRestaurantData } from "@/lib/staff-backend/restaurant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return noStoreJson(await getRestaurantData());
}

export async function PUT() {
  return noStoreJson(
    {
      error: "Restaurant mutation from web dashboard is deprecated in waiter v1.",
    },
    501,
  );
}
