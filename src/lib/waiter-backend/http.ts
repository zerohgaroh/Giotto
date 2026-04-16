import { NextResponse } from "next/server";
import { ApiError } from "./backend";

export function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error && error.message === "UNAUTHORIZED_WAITER") {
    return NextResponse.json({ error: "Необходима авторизация официанта" }, { status: 401 });
  }

  return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
}

export function noStoreJson(data: unknown, status: number = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
