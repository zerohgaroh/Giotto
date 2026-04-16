import { NextResponse } from "next/server";
import {
  GUEST_TABLE_COOKIE,
  buildGuestSessionValue,
  isValidGuestAccessKey,
  normalizeGuestAccessKey,
  normalizeTableId,
} from "@/lib/guest-auth";

type Params = {
  params: {
    tableId: string;
    accessKey: string;
  };
};

export function GET(request: Request, { params }: Params) {
  const tableId = normalizeTableId(params.tableId);
  const accessKey = normalizeGuestAccessKey(params.accessKey);

  if (!tableId || !accessKey || !isValidGuestAccessKey(tableId, accessKey)) {
    return NextResponse.redirect(new URL("/guest?error=invalid-link", request.url));
  }

  const response = NextResponse.redirect(
    new URL(`/table/${encodeURIComponent(tableId)}`, request.url),
  );
  response.cookies.set(GUEST_TABLE_COOKIE, buildGuestSessionValue(tableId, accessKey), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
