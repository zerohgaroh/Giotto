import { prisma } from "./prisma";
import { ApiError, getWaiterAssignmentsMap, normalizeManager, normalizeWaiter } from "./projections";
import { verifyPassword } from "./password";
import { ensureStaffBackendReady } from "./seed";
import { hashOpaqueToken, issueAccessToken, issueRefreshToken, parseAccessToken, parseRefreshToken } from "./tokens";
import type { StaffLoginResponse, StaffSession } from "./types";

function buildAuthResponse(user: { id: string; role: "waiter" | "manager"; name: string }, sessionId: string): StaffLoginResponse {
  const accessToken = issueAccessToken({
    role: user.role,
    userId: user.id,
    name: user.name,
    sessionId,
  });
  const refreshToken = issueRefreshToken({
    role: user.role,
    userId: user.id,
    name: user.name,
    sessionId,
  });

  const access = parseAccessToken(accessToken);
  if (!access) {
    throw new ApiError(500, "Не удалось выпустить access token");
  }

  return {
    accessToken,
    refreshToken,
    role: user.role,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
    },
    expiresAt: access.expiresAt,
  };
}

async function resolveRefreshSession(sessionId: string, token: string) {
  await ensureStaffBackendReady();
  const session = await prisma.staffRefreshSession.findUnique({
    where: { id: sessionId },
    include: { staffUser: true },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (session.tokenHash !== hashOpaqueToken(token)) {
    return null;
  }

  if (!session.staffUser.active) {
    return null;
  }

  return session;
}

async function revokeRefreshSession(sessionId: string) {
  await prisma.staffRefreshSession.updateMany({
    where: {
      id: sessionId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function loginStaff(login: string, password: string): Promise<StaffLoginResponse> {
  await ensureStaffBackendReady();

  const normalizedLogin = login.trim().toLowerCase();
  if (!normalizedLogin || !password) {
    throw new ApiError(400, "Нужны логин и пароль");
  }

  const user = await prisma.staffUser.findUnique({
    where: { login: normalizedLogin },
  });

  if (!user || !user.active) {
    throw new ApiError(401, "Неверный логин или пароль");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Неверный логин или пароль");
  }

  const auth = buildAuthResponse(
    {
      id: user.id,
      role: user.role,
      name: user.name,
    },
    crypto.randomUUID(),
  );

  const refreshPayload = parseRefreshToken(auth.refreshToken);
  if (!refreshPayload) {
    throw new ApiError(500, "Не удалось выпустить refresh token");
  }

  await prisma.staffRefreshSession.create({
    data: {
      id: refreshPayload.sessionId,
      staffUserId: user.id,
      tokenHash: hashOpaqueToken(auth.refreshToken),
      expiresAt: new Date(refreshPayload.exp * 1000),
      lastUsedAt: new Date(),
    },
  });

  return auth;
}

export async function refreshStaffSession(refreshToken: string): Promise<StaffLoginResponse> {
  const payload = parseRefreshToken(refreshToken);
  if (!payload) {
    throw new ApiError(401, "Refresh token недействителен");
  }

  const session = await resolveRefreshSession(payload.sessionId, refreshToken);
  if (!session) {
    throw new ApiError(401, "Сессия истекла");
  }

  const next = buildAuthResponse(
    {
      id: session.staffUser.id,
      role: session.staffUser.role,
      name: session.staffUser.name,
    },
    session.id,
  );

  const nextRefresh = parseRefreshToken(next.refreshToken);
  if (!nextRefresh) {
    throw new ApiError(500, "Не удалось обновить refresh token");
  }

  await prisma.staffRefreshSession.update({
    where: { id: session.id },
    data: {
      tokenHash: hashOpaqueToken(next.refreshToken),
      expiresAt: new Date(nextRefresh.exp * 1000),
      lastUsedAt: new Date(),
    },
  });

  return next;
}

export async function logoutStaff(input: { refreshToken?: string; accessToken?: string }) {
  const refreshPayload = parseRefreshToken(input.refreshToken);
  if (refreshPayload) {
    await revokeRefreshSession(refreshPayload.sessionId);
    return { ok: true };
  }

  const access = parseAccessToken(input.accessToken);
  if (access) {
    await revokeRefreshSession(access.sessionId);
  }

  return { ok: true };
}

export async function getStaffSession(accessToken: string | undefined): Promise<StaffSession | null> {
  const parsed = parseAccessToken(accessToken);
  if (!parsed) return null;

  await ensureStaffBackendReady();

  const refreshSession = await prisma.staffRefreshSession.findUnique({
    where: { id: parsed.sessionId },
    include: { staffUser: true },
  });

  if (!refreshSession || refreshSession.revokedAt || refreshSession.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (!refreshSession.staffUser.active) {
    return null;
  }

  return {
    role: refreshSession.staffUser.role,
    userId: refreshSession.staffUser.id,
    name: refreshSession.staffUser.name,
    sessionId: refreshSession.id,
    expiresAt: parsed.expiresAt,
  };
}

export async function getWaiterById(waiterId: string) {
  await ensureStaffBackendReady();
  const waiter = await prisma.staffUser.findFirst({
    where: {
      id: waiterId,
      role: "waiter",
      active: true,
    },
  });

  if (!waiter) return null;

  const { tableIdsByWaiter } = await getWaiterAssignmentsMap();
  return normalizeWaiter(waiter, (tableIdsByWaiter.get(waiter.id) ?? []).sort((a, b) => a - b));
}

export async function getManagerById(managerId: string) {
  await ensureStaffBackendReady();
  const manager = await prisma.staffUser.findFirst({
    where: {
      id: managerId,
      role: "manager",
      active: true,
    },
  });

  return manager ? normalizeManager(manager) : null;
}
