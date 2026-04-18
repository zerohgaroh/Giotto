import { NextResponse } from "next/server";
import { ApiError } from "./projections";

export function noStoreJson(data: unknown, status: number = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return noStoreJson({ error: error.message }, error.status);
  }

  if (error instanceof Error) {
    return noStoreJson({ error: error.message }, 500);
  }

  return noStoreJson({ error: "Внутренняя ошибка сервера" }, 500);
}
