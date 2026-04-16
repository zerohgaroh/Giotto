import { NextResponse } from "next/server";
import { getHallData, setHallData } from "@/lib/server-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hall = await getHallData();
  return NextResponse.json(hall, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const hall = await setHallData(body);
  return NextResponse.json(hall, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
