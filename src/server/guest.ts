import type { RequestHandler } from "express";
import {
  GUEST_TABLE_COOKIE,
  buildGuestSessionValue,
  hasGuestAccessToTable,
  isValidGuestAccessKey,
  normalizeGuestAccessKey,
  normalizeTableId,
} from "../lib/guest-auth";
import { tableLabelFromId } from "../lib/table-label";

export const GUEST_ERROR_TEXT: Record<string, string> = {
  "invalid-link": "Ссылка стола недействительна. Откройте страницу через NFC-метку вашего стола.",
  "missing-access-key": "Нужна персональная ссылка стола. Откройте страницу через NFC-метку вашего стола.",
};

function guestCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12 * 1000,
  };
}

export function buildGuestRedirectPath(tableId: string, accessKey: string) {
  return {
    shortPath: `/t/${encodeURIComponent(tableId)}/${accessKey}`,
    tablePath: `/table/${encodeURIComponent(tableId)}`,
    menuPath: `/table/${encodeURIComponent(tableId)}/menu`,
    cartPath: `/table/${encodeURIComponent(tableId)}/cart`,
    waiterPath: `/table/${encodeURIComponent(tableId)}/waiter`,
    complaintPath: `/table/${encodeURIComponent(tableId)}/complaint`,
  };
}

export function createGuestAccessHandler(): RequestHandler {
  return (req, res) => {
    const tableId = normalizeTableId(String(req.params.tableId ?? ""));
    const accessKey = normalizeGuestAccessKey(String(req.params.accessKey ?? ""));

    if (!tableId || !accessKey || !isValidGuestAccessKey(tableId, accessKey)) {
      res.redirect("/guest?error=invalid-link");
      return;
    }

    res.cookie(GUEST_TABLE_COOKIE, buildGuestSessionValue(tableId, accessKey), guestCookieOptions());
    res.redirect(buildGuestRedirectPath(tableId, accessKey).tablePath);
  };
}

export const requireGuestTableAccess: RequestHandler = (req, res, next) => {
  const tableId = normalizeTableId(String(req.params.tableId ?? ""));
  if (!tableId) {
    res.redirect("/guest?error=invalid-link");
    return;
  }

  if (!hasGuestAccessToTable(req.cookies?.[GUEST_TABLE_COOKIE], tableId)) {
    res.redirect("/guest?error=invalid-link");
    return;
  }

  req.guestTableId = tableId;
  next();
};

export function getGuestErrorText(error: unknown) {
  if (typeof error !== "string") return undefined;
  return GUEST_ERROR_TEXT[error];
}

export function buildTableLocals(tableId: string) {
  const paths = buildGuestRedirectPath(tableId, "");
  return {
    tableId,
    tableLabel: tableLabelFromId(tableId),
    tablePath: paths.tablePath,
    menuPath: paths.menuPath,
    cartPath: paths.cartPath,
    waiterPath: paths.waiterPath,
    complaintPath: paths.complaintPath,
  };
}
