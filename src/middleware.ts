import { NextRequest, NextResponse } from "next/server";
import { GUEST_TABLE_COOKIE, hasGuestAccessToTable, normalizeTableId } from "@/lib/guest-auth";

function applyNoCacheInDev(response: NextResponse) {
  if (process.env.NODE_ENV === "development") {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0",
    );
  }
  return response;
}

function tableIdFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "table" || !segments[1]) return null;
  return normalizeTableId(segments[1]);
}

/**
 * In dev, Safari often keeps a cached HTML document that still references old
 * hashed `/_next/static/*` files after a restart → red rows in Network, no CSS/JS.
 * Disable caching for document navigations only (not `/_next/static`).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/table/")) {
    const tableId = tableIdFromPath(pathname);
    const guestSession = request.cookies.get(GUEST_TABLE_COOKIE)?.value;
    if (!tableId || !hasGuestAccessToTable(guestSession, tableId)) {
      const url = request.nextUrl.clone();
      url.pathname = "/guest";
      url.searchParams.set("error", "invalid-link");
      return applyNoCacheInDev(NextResponse.redirect(url));
    }
  }

  return applyNoCacheInDev(NextResponse.next());
}

export const config = {
  matcher: ["/", "/guest", "/table/:path*", "/t/:path*", "/waiter/:path*"],
};
