import { ApiError } from "./projections";

export function parseTableId(raw: string) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new ApiError(400, "Invalid table id");
  }
  return value;
}

export function parseOptionalInt(raw: string | null, fallback?: number) {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new ApiError(400, "Invalid integer query param");
  }
  return value;
}
