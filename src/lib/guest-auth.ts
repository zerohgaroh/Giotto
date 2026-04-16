export const GUEST_TABLE_COOKIE = "giotto_guest_table_session";

const DEFAULT_GUEST_LINK_SALT = "giotto_guest_link_salt_v1";
const TABLE_ID_RE = /^[A-Za-z0-9_-]{1,48}$/;
const ACCESS_KEY_RE = /^[a-z0-9]{8,18}$/;

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function normalizeTableId(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  const tableId = decoded.trim();
  if (!TABLE_ID_RE.test(tableId)) return null;
  return tableId;
}

export function normalizeGuestAccessKey(raw: string): string | null {
  const accessKey = raw.trim().toLowerCase();
  if (!ACCESS_KEY_RE.test(accessKey)) return null;
  return accessKey;
}

export function buildGuestAccessKey(tableId: string): string {
  const salt = process.env.GIOTTO_GUEST_LINK_SALT ?? DEFAULT_GUEST_LINK_SALT;
  const first = fnv1a32(`a:${tableId}:${salt}`).toString(36);
  const second = fnv1a32(`b:${salt}:${tableId}`).toString(36);
  return `${first}${second}`.slice(0, 12);
}

export function isValidGuestAccessKey(tableId: string, accessKey: string): boolean {
  return buildGuestAccessKey(tableId) === accessKey;
}

export function buildGuestSessionValue(tableId: string, accessKey: string): string {
  return `${tableId}:${accessKey}`;
}

export function parseGuestSessionValue(value: string | undefined): {
  tableId: string;
  accessKey: string;
} | null {
  if (!value) return null;
  const [tableIdRaw, accessKeyRaw] = value.split(":");
  if (!tableIdRaw || !accessKeyRaw) return null;

  const tableId = normalizeTableId(tableIdRaw);
  const accessKey = normalizeGuestAccessKey(accessKeyRaw);

  if (!tableId || !accessKey) return null;
  return { tableId, accessKey };
}

export function hasGuestAccessToTable(
  sessionValue: string | undefined,
  tableId: string,
): boolean {
  const parsed = parseGuestSessionValue(sessionValue);
  if (!parsed) return false;
  if (parsed.tableId !== tableId) return false;
  return isValidGuestAccessKey(parsed.tableId, parsed.accessKey);
}
