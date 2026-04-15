import { NextResponse } from "next/server";

/**
 * In dev, Safari often keeps a cached HTML document that still references old
 * hashed `/_next/static/*` files after a restart → red rows in Network, no CSS/JS.
 * Disable caching for document navigations only (not `/_next/static`).
 */
export function middleware() {
  const res = NextResponse.next();
  if (process.env.NODE_ENV === "development") {
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0",
    );
  }
  return res;
}

export const config = {
  matcher: ["/", "/table/:path*", "/t/:path*", "/waiter/:path*"],
};
