import { NextResponse } from "next/server";
import { MANAGER_COOKIE } from "@/lib/manager-auth";
import { WAITER_COOKIE } from "@/lib/waiter-auth";

export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(WAITER_COOKIE);
  response.cookies.delete(MANAGER_COOKIE);
  return response;
}
