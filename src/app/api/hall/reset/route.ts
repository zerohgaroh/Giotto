import { NextResponse } from "next/server";
import { resetHallData } from "@/lib/server-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const hall = await resetHallData();
  return NextResponse.json(hall, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
