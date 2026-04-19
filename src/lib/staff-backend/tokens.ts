import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { StaffRole, StaffSession } from "./types";

const DEFAULT_SECRET = "giotto_staff_token_secret_v1";
const ACCESS_TTL_SECONDS = 60 * 15;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

type BaseTokenPayload = {
  kind: "access" | "refresh";
  role: StaffRole;
  userId: string;
  name: string;
  sessionId: string;
  iat: number;
  exp: number;
};

type AccessPayload = BaseTokenPayload & {
  kind: "access";
};

type RefreshPayload = BaseTokenPayload & {
  kind: "refresh";
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
  const secret = process.env.GIOTTO_STAFF_TOKEN_SECRET ?? DEFAULT_SECRET;
  return base64UrlEncode(createHmac("sha256", secret).update(value).digest());
}

function issueToken(payload: BaseTokenPayload) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

function parseToken<T extends BaseTokenPayload>(
  token: string | undefined,
  expectedKind: T["kind"],
): T | null {
  if (!token) return null;
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;

  const expectedSignature = sign(`${header}.${payload}`);
  const safeSignature = Buffer.from(signature);
  const safeExpected = Buffer.from(expectedSignature);
  if (safeSignature.length !== safeExpected.length) return null;
  if (!timingSafeEqual(safeSignature, safeExpected)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as Partial<T>;
    if (parsed.kind !== expectedKind) return null;
    if (parsed.role !== "waiter" && parsed.role !== "manager") return null;
    if (typeof parsed.userId !== "string" || !parsed.userId) return null;
    if (typeof parsed.name !== "string" || !parsed.name) return null;
    if (typeof parsed.sessionId !== "string" || !parsed.sessionId) return null;
    if (typeof parsed.exp !== "number") return null;
    if (Date.now() >= parsed.exp * 1000) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export function issueAccessToken(input: {
  role: StaffRole;
  userId: string;
  name: string;
  sessionId: string;
  ttlSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  return issueToken({
    kind: "access",
    role: input.role,
    userId: input.userId,
    name: input.name,
    sessionId: input.sessionId,
    iat: now,
    exp: now + (input.ttlSeconds ?? ACCESS_TTL_SECONDS),
  } satisfies AccessPayload);
}

export function issueRefreshToken(input: {
  role: StaffRole;
  userId: string;
  name: string;
  sessionId: string;
  ttlSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  return issueToken({
    kind: "refresh",
    role: input.role,
    userId: input.userId,
    name: input.name,
    sessionId: input.sessionId,
    iat: now,
    exp: now + (input.ttlSeconds ?? REFRESH_TTL_SECONDS),
  } satisfies RefreshPayload);
}

export function parseAccessToken(token: string | undefined) {
  const payload = parseToken<AccessPayload>(token, "access");
  if (!payload) return null;
  return {
    role: payload.role,
    userId: payload.userId,
    name: payload.name,
    sessionId: payload.sessionId,
    expiresAt: payload.exp * 1000,
  } satisfies StaffSession;
}

export function parseRefreshToken(token: string | undefined) {
  return parseToken<RefreshPayload>(token, "refresh");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
