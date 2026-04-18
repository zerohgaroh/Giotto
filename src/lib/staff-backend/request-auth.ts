import { getStaffSession } from "./auth";
import { ApiError } from "./projections";
import type { StaffSession } from "./types";

export function readBearerToken(raw: string | null | undefined) {
  if (!raw) return undefined;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

export async function requireStaffSession(request: Request): Promise<StaffSession> {
  const token = readBearerToken(request.headers.get("authorization"));
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
