import type { RequestHandler } from "express";
import { getStaffSession } from "@/lib/staff-backend/auth";
import { ApiError } from "@/lib/staff-backend/projections";
import type { StaffRole } from "@/lib/staff-backend/types";
import { asyncHandler } from "./http";

function readBearerToken(raw: string | undefined) {
  if (!raw) return undefined;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function readAccessToken(req: Parameters<RequestHandler>[0], allowQuery: boolean) {
  const bearer = readBearerToken(req.get("authorization") || undefined);
  if (bearer) return bearer;
  if (!allowQuery) return undefined;

  const queryToken = typeof req.query.accessToken === "string" ? req.query.accessToken.trim() : "";
  return queryToken || undefined;
}

export function requireStaffAuth(options?: { allowQuery?: boolean; role?: StaffRole }): RequestHandler {
  const allowQuery = options?.allowQuery === true;
  const role = options?.role;

  return asyncHandler(async (req, _res, next) => {
    const session = await getStaffSession(readAccessToken(req, allowQuery));
    if (!session) {
      throw new ApiError(401, "Staff authentication is required");
    }

    if (role && session.role !== role) {
      throw new ApiError(role === "waiter" ? 403 : 403, role === "waiter" ? "Waiter-only access" : "Manager-only access");
    }

    req.staffSession = session;
    next();
  });
}
