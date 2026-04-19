import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "@/lib/staff-backend/projections";

type AsyncHandler<TReq extends Request = Request> = (
  req: TReq,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler<TReq extends Request = Request>(handler: AsyncHandler<TReq>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req as TReq, res, next)).catch(next);
  };
}

export function applyNoStore(res: Response) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
}

export function jsonNoStore(res: Response, payload: unknown, status: number = 200) {
  applyNoStore(res);
  res.status(status).json(payload);
}

export function sendApiError(res: Response, error: unknown) {
  if (error instanceof ApiError) {
    return jsonNoStore(res, { error: error.message }, error.status);
  }

  if (error instanceof Error) {
    return jsonNoStore(res, { error: error.message }, 500);
  }

  return jsonNoStore(res, { error: "Внутренняя ошибка сервера" }, 500);
}

export function isHtmxRequest(req: Request) {
  return req.get("HX-Request") === "true";
}

export function serializeForScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function getRequestOrigin(req: Request) {
  const configured = process.env.GIOTTO_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const protocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
  const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host") || "localhost:3000";
  return `${protocol}://${host}`.replace(/\/$/, "");
}

export function getAbsoluteUrl(req: Request) {
  return `${getRequestOrigin(req)}${req.originalUrl}`;
}

export function toFetchRequest(req: Request) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(key, entry);
      }
      continue;
    }
    if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  return new Request(getAbsoluteUrl(req), {
    method: req.method,
    headers,
  });
}

export function wantsHtml(req: Request) {
  const accept = req.get("accept") || "";
  return accept.includes("text/html");
}
