import { buildGuestAccessKey } from "@/lib/guest-auth";
import type { GuestTableLink } from "./types";

function normalizeBaseUrl(value: string | undefined | null) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.replace(/\/$/, "");
}

export function resolvePublicBaseUrl(input?: { publicBaseUrl?: string; request?: Request }) {
  const configured = normalizeBaseUrl(input?.publicBaseUrl ?? process.env.GIOTTO_PUBLIC_BASE_URL);
  if (configured) return configured;

  if (input?.request) {
    return new URL(input.request.url).origin.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export function buildGuestTableLink(
  tableId: number,
  input?: { publicBaseUrl?: string; request?: Request },
): GuestTableLink {
  const normalizedTableId = String(Math.trunc(tableId));
  const accessKey = buildGuestAccessKey(normalizedTableId);
  const shortPath = `/t/${encodeURIComponent(normalizedTableId)}/${accessKey}`;
  const tablePath = `/table/${encodeURIComponent(normalizedTableId)}`;
  const menuPath = `${tablePath}/menu`;
  const waiterPath = `${tablePath}/waiter`;
  const baseUrl = resolvePublicBaseUrl(input);

  return {
    tableId: Number(normalizedTableId),
    accessKey,
    shortPath,
    tablePath,
    menuPath,
    waiterPath,
    url: `${baseUrl}${shortPath}`,
  };
}
