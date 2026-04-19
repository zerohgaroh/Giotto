import { createHmac, timingSafeEqual } from "crypto";
import type { ManagerAuthSession } from "./waiter-backend/types";

export const MANAGER_COOKIE = "giotto_manager_session";
const DEFAULT_TTL_SECONDS = 60 * 60 * 12;
const DEFAULT_SECRET = "giotto_demo_jwt_secret_v1";

type ManagerJwtPayload = {
  role: "manager";
  managerId: string;
  iat: number;
  exp: number;
};

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf-8");
}

function sign(value: string): string {
  const secret = process.env.GIOTTO_DEMO_JWT_SECRET ?? DEFAULT_SECRET;
  return base64UrlEncode(createHmac("sha256", secret).update(value).digest());
}

export function issueManagerToken(
  managerId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: ManagerJwtPayload = {
    role: "manager",
    managerId,
    iat: now,
    exp: now + ttlSeconds,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function parseManagerToken(token: string | undefined): ManagerAuthSession | null {
  if (!token) return null;
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;

  const expectedSignature = sign(`${header}.${payload}`);
  const safeSignature = Buffer.from(signature);
  const safeExpected = Buffer.from(expectedSignature);
  if (safeSignature.length !== safeExpected.length) return null;
  if (!timingSafeEqual(safeSignature, safeExpected)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as Partial<ManagerJwtPayload>;
    if (parsed.role !== "manager") return null;
    if (typeof parsed.managerId !== "string" || parsed.managerId.length === 0) return null;
    if (typeof parsed.exp !== "number") return null;

    const expiresAt = parsed.exp * 1000;
    if (Date.now() >= expiresAt) return null;

    return {
      role: "manager",
      managerId: parsed.managerId,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export function managerCookieOptions(maxAgeSec: number = DEFAULT_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}
