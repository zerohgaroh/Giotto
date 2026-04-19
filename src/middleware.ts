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

function isPrivateDevHost(hostname: string) {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;

  const octets = hostname.split(".");
  if (octets.length === 4 && octets.every((part) => /^\d+$/.test(part))) {
    const first = Number(octets[0]);
    const second = Number(octets[1]);
    if (first === 172 && second >= 16 && second <= 31) return true;
  }

  return false;
}

function getAllowedCorsOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    const url = new URL(origin);
    if (isPrivateDevHost(url.hostname)) return origin;
  } catch {
    return null;
  }

  return null;
}

function appendVary(current: string | null, next: string) {
  if (!current) return next;
  const values = current
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values.includes(next)) values.push(next);
  return values.join(", ");
}

function applyCors(request: NextRequest, response: NextResponse) {
  const origin = getAllowedCorsOrigin(request);
  if (!origin) return response;

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Vary", appendVary(response.headers.get("Vary"), "Origin"));

  return response;
}

/**
 * In dev, Safari often keeps a cached HTML document that still references old
 * hashed `/_next/static/*` files after a restart → red rows in Network, no CSS/JS.
 * Disable caching for document navigations only (not `/_next/static`).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      return applyNoCacheInDev(applyCors(request, new NextResponse(null, { status: 204 })));
    }

    return applyNoCacheInDev(applyCors(request, NextResponse.next()));
  }

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
  matcher: ["/", "/guest", "/table/:path*", "/t/:path*", "/waiter/:path*", "/api/:path*"],
};
