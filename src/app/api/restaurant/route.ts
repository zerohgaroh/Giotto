import { NextResponse } from "next/server";
import { getRestaurantData, setRestaurantData } from "@/lib/server-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const restaurant = await getRestaurantData();
  return NextResponse.json(restaurant, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const restaurant = await setRestaurantData(body);
  return NextResponse.json(restaurant, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
