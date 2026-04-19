import { getStaffSession } from "./auth";
import { ApiError } from "./projections";
import type { StaffSession } from "./types";

export function readBearerToken(raw: string | null | undefined) {
  if (!raw) return undefined;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

export function readAccessTokenFromRequest(request: Request, options?: { allowQuery?: boolean }) {
  const bearer = readBearerToken(request.headers.get("authorization"));
  if (bearer) return bearer;

  if (!options?.allowQuery) return undefined;

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("accessToken")?.trim();
  return queryToken || undefined;
}

export async function requireStaffSession(request: Request, options?: { allowQuery?: boolean }): Promise<StaffSession> {
  const token = readAccessTokenFromRequest(request, options);
  const session = await getStaffSession(token);
  if (!session) {
    throw new ApiError(401, "Staff authentication is required");
  }
  return session;
}

export async function requireWaiterSession(request: Request): Promise<StaffSession & { role: "waiter" }> {
  const session = await requireStaffSession(request);
  if (session.role !== "waiter") {
    throw new ApiError(403, "Waiter-only access");
  }
  return session as StaffSession & { role: "waiter" };
}

export async function requireManagerSession(request: Request): Promise<StaffSession & { role: "manager" }> {
  const session = await requireStaffSession(request);
  if (session.role !== "manager") {
    throw new ApiError(403, "Manager-only access");
  }
  return session as StaffSession & { role: "manager" };
}
