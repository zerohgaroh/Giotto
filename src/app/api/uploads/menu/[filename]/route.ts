import { NextResponse } from "next/server";
import { readManagerMenuImage } from "@/lib/staff-backend/menu-images";
import { toErrorResponse } from "@/lib/staff-backend/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;
    const image = await readManagerMenuImage(filename);

    return new NextResponse(image.body, {
      status: 200,
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
