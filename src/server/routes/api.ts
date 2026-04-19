import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { getStaffSession, getWaiterById, loginStaff, logoutStaff, refreshStaffSession } from "../../lib/staff-backend/auth";
import { getStaffBootstrap } from "../../lib/staff-backend/bootstrap";
import { createGuestRequest, getGuestRequestCooldown, submitGuestOrder, submitGuestReview } from "../../lib/staff-backend/guest";
import { getManagerHall, getManagerHistory, getManagerLayout, getManagerMenuSnapshot, getManagerTableDetail, listManagerWaiters, getManagerWaiterDetail, createManagerWaiter, updateManagerWaiter, resetManagerWaiterPassword, replaceManagerWaiterAssignments, createManagerMenuCategory, updateManagerMenuCategory, deleteManagerMenuCategory, createManagerDish, updateManagerDish, deleteManagerDish, toggleManagerDishAvailability, reorderManagerMenu, updateManagerLayout, createManagerTable, archiveManagerTable, restoreManagerTable, reassignManagerTable, closeManagerTable } from "../../lib/staff-backend/manager";
import { readManagerMenuImage, saveManagerMenuImage } from "../../lib/staff-backend/menu-images";
import { ApiError } from "../../lib/staff-backend/projections";
import { parseOptionalInt, parseTableId } from "../../lib/staff-backend/route-parsers";
import { getRestaurantData } from "../../lib/staff-backend/restaurant";
import { applyWaiterAssignmentChange, canWaiterReceiveRealtimeEvent } from "../../lib/staff-backend/realtime-access";
import { getWaiterQueue, getWaiterShiftSummary, getWaiterShortcuts, getWaiterTableDetail, getWaiterTables, acknowledgeWaiterRequest, acknowledgeWaiterTask, startWaiterTask, completeWaiterTask, createWaiterFollowUpTask, addWaiterOrder, repeatLastWaiterOrder, updateWaiterShortcuts, setWaiterTableNote, markWaiterDone, registerPushDevice } from "../../lib/staff-backend/waiter";
import { getHallProjection } from "../../lib/staff-backend/projections";
import { resetStaffSeedData } from "../../lib/staff-backend/seed";
import { subscribeRealtimeEvents } from "../../lib/waiter-backend/realtime";
import { requireStaffAuth } from "../auth";
import { asyncHandler, getAbsoluteUrl, getRequestOrigin, jsonNoStore, sendApiError, toFetchRequest } from "../http";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asNumberArray(value: unknown) {
  return Array.isArray(value)
    ? value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry) && entry > 0)
    : [];
}

function bodyObject(req: Request) {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
}

function parseRequestType(raw: unknown) {
  return raw === "bill" ? "bill" : "waiter";
}

function paramString(value: string | string[] | undefined) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return "";
}

function queryString(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return undefined;
}

function unauthorizedMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unauthorized";
}

function createSseStream(res: Response) {
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  return {
    push(event: string, data: unknown) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    ping() {
      res.write(`: ping ${Date.now()}\n\n`);
    },
    close() {
      res.end();
    },
  };
}

export function createApiRouter() {
  const api = Router();

  api.get(
    "/restaurant",
    asyncHandler(async (_req, res) => {
      jsonNoStore(res, await getRestaurantData());
    }),
  );

  api.put("/restaurant", (_req, res) => {
    jsonNoStore(
      res,
      {
        error: "Restaurant mutation from web dashboard is deprecated in waiter v1.",
      },
      501,
    );
  });

  api.get(
    "/hall",
    asyncHandler(async (_req, res) => {
      jsonNoStore(res, await getHallProjection());
    }),
  );

  api.put("/hall", (_req, res) => {
    jsonNoStore(
      res,
      {
        error: "Hall mutation from web dashboard is deprecated in waiter v1.",
      },
      501,
    );
  });

  api.post(
    "/hall/reset",
    asyncHandler(async (_req, res) => {
      await resetStaffSeedData();
      jsonNoStore(res, await getHallProjection());
    }),
  );

  api.get("/realtime/stream", (req, res) => {
    const stream = createSseStream(res);
    stream.push("ready", { at: Date.now() });

    const unsubscribe = subscribeRealtimeEvents((event) => {
      stream.push(event.type, event);
    });
    const heartbeat = setInterval(() => stream.ping(), 15_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      stream.close();
    });
  });

  api.get(
    "/table/:tableId/request",
    asyncHandler(async (req, res) => {
      const type = parseRequestType(req.query.type);
      const tableId = parseTableId(paramString(req.params.tableId));
      const cooldown = await getGuestRequestCooldown({ tableId, type });
      jsonNoStore(res, { cooldown });
    }),
  );

  api.post(
    "/table/:tableId/request",
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      const type = parseRequestType(body.type);
      const tableId = parseTableId(paramString(req.params.tableId));
      jsonNoStore(
        res,
        await createGuestRequest({
          tableId,
          type,
          reason: typeof body.reason === "string" ? body.reason : undefined,
        }),
      );
    }),
  );

  api.post(
    "/table/:tableId/orders",
    asyncHandler(async (req, res) => {
      const tableId = parseTableId(paramString(req.params.tableId));
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await submitGuestOrder({
          tableId,
          items: Array.isArray(body.items) ? body.items : [],
        }),
      );
    }),
  );

  api.post(
    "/table/:tableId/review",
    asyncHandler(async (req, res) => {
      const tableId = parseTableId(paramString(req.params.tableId));
      const body = bodyObject(req);
      const rating = Number(body.rating ?? 0);

      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        jsonNoStore(res, { error: "Оценка должна быть от 1 до 5" }, 400);
        return;
      }

      jsonNoStore(
        res,
        {
          review: await submitGuestReview({
            tableId,
            rating,
            comment: typeof body.comment === "string" ? body.comment : undefined,
          }),
        },
      );
    }),
  );

  api.get(
    "/uploads/menu/:filename",
    asyncHandler(async (req, res) => {
      const image = await readManagerMenuImage(paramString(req.params.filename));
      res.setHeader("Content-Type", image.mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.status(200).send(image.body);
    }),
  );

  api.post(
    "/staff/auth/login",
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(res, await loginStaff(asString(body.login), asString(body.password)));
    }),
  );

  api.post(
    "/staff/auth/refresh",
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(res, await refreshStaffSession(asString(body.refreshToken)));
    }),
  );

  api.post(
    "/staff/auth/logout",
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await logoutStaff({
          refreshToken: typeof body.refreshToken === "string" ? body.refreshToken : undefined,
          accessToken: req.get("authorization") || undefined,
        }),
      );
    }),
  );

  api.get(
    "/staff/me",
    requireStaffAuth(),
    asyncHandler(async (req, res) => {
      jsonNoStore(res, await getStaffBootstrap(req.staffSession!));
    }),
  );

  api.get("/staff/realtime/stream", async (req, res) => {
    let waiterId: string | null = null;
    let allowedTableIds: Set<number> | null = null;

    try {
      const accessToken = queryString(req.query.accessToken);
      const token = req.get("authorization") || (accessToken ? `Bearer ${accessToken}` : undefined);
      const session = await getStaffSession(token ? token.replace(/^Bearer\s+/i, "") : undefined);
      if (!session) {
        throw new Error("Staff authentication is required");
      }

      if (session.role === "waiter") {
        waiterId = session.userId;
        const waiter = await getWaiterById(session.userId);
        if (!waiter) {
          throw new Error("Unauthorized");
        }
        allowedTableIds = new Set(waiter.tableIds);
      }
    } catch (error) {
      jsonNoStore(res, { error: unauthorizedMessage(error) }, 401);
      return;
    }

    const stream = createSseStream(res);
    stream.push("ready", { at: Date.now() });

    const unsubscribe = subscribeRealtimeEvents((event) => {
      applyWaiterAssignmentChange(waiterId, allowedTableIds, event);
      if (!canWaiterReceiveRealtimeEvent(waiterId, allowedTableIds, event)) {
        return;
      }
      stream.push(event.type, event);
    });
    const heartbeat = setInterval(() => stream.ping(), 15_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      stream.close();
    });
  });

  api.post(
    "/staff/devices/push-token",
    requireStaffAuth(),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await registerPushDevice(req.staffSession!, {
          token: asString(body.token),
          platform:
            body.platform === "ios" || body.platform === "android" || body.platform === "web" ? body.platform : "expo",
          appVersion: typeof body.appVersion === "string" ? body.appVersion : undefined,
          deviceId: typeof body.deviceId === "string" ? body.deviceId : undefined,
        }),
      );
    }),
  );

  api.get(
    "/staff/waiter/tables",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(res, await getWaiterTables(req.staffSession!.userId));
    }),
  );

  api.get(
    "/staff/waiter/queue",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(res, await getWaiterQueue(req.staffSession!.userId));
    }),
  );

  api.get(
    "/staff/waiter/shift-summary",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await getWaiterShiftSummary({
          waiterId: req.staffSession!.userId,
          sessionId: req.staffSession!.sessionId,
        }),
      );
    }),
  );

  api
    .route("/staff/waiter/shortcuts")
    .get(
      requireStaffAuth({ role: "waiter" }),
      asyncHandler(async (req, res) => {
        jsonNoStore(res, await getWaiterShortcuts(req.staffSession!.userId));
      }),
    )
    .put(
      requireStaffAuth({ role: "waiter" }),
      asyncHandler(async (req, res) => {
        const body = bodyObject(req);
        jsonNoStore(
          res,
          await updateWaiterShortcuts({
            waiterId: req.staffSession!.userId,
            payload: {
              favoriteDishIds: asStringArray(body.favoriteDishIds),
              noteTemplates: asStringArray(body.noteTemplates),
              quickOrderPresets: Array.isArray(body.quickOrderPresets) ? body.quickOrderPresets : [],
            },
          }),
        );
      }),
    );

  api.get(
    "/staff/waiter/tables/:tableId",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(res, await getWaiterTableDetail(req.staffSession!.userId, parseTableId(paramString(req.params.tableId))));
    }),
  );

  api.post(
    "/staff/waiter/tables/:tableId/ack",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await acknowledgeWaiterRequest({
          waiterId: req.staffSession!.userId,
          tableId: parseTableId(paramString(req.params.tableId)),
          requestId: typeof body.requestId === "string" ? body.requestId : undefined,
        }),
      );
    }),
  );

  api.post(
    "/staff/waiter/tables/:tableId/follow-ups",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await createWaiterFollowUpTask({
          waiterId: req.staffSession!.userId,
          tableId: parseTableId(paramString(req.params.tableId)),
          title: asString(body.title),
          dueInMin: typeof body.dueInMin === "number" ? body.dueInMin : Number(body.dueInMin ?? 0) || undefined,
          note: typeof body.note === "string" ? body.note : undefined,
        }),
      );
    }),
  );

  api.post(
    "/staff/waiter/tables/:tableId/done",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await markWaiterDone({
          waiterId: req.staffSession!.userId,
          tableId: parseTableId(paramString(req.params.tableId)),
        }),
      );
    }),
  );

  api.patch(
    "/staff/waiter/tables/:tableId/note",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await setWaiterTableNote({
          waiterId: req.staffSession!.userId,
          tableId: parseTableId(paramString(req.params.tableId)),
          note: asString(body.note),
        }),
      );
    }),
  );

  api.post(
    "/staff/waiter/tables/:tableId/orders",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await addWaiterOrder({
          waiterId: req.staffSession!.userId,
          tableId: parseTableId(paramString(req.params.tableId)),
          items: Array.isArray(body.items) ? body.items : [],
          mutationKey: typeof body.mutationKey === "string" ? body.mutationKey : undefined,
        }),
      );
    }),
  );

  api.post(
    "/staff/waiter/tables/:tableId/orders/repeat-last",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await repeatLastWaiterOrder({
          waiterId: req.staffSession!.userId,
          tableId: parseTableId(paramString(req.params.tableId)),
          payload: {
            sourceSessionId: typeof body.sourceSessionId === "string" ? body.sourceSessionId : undefined,
            mutationKey: typeof body.mutationKey === "string" ? body.mutationKey : undefined,
          },
        }),
      );
    }),
  );

  api.post(
    "/staff/waiter/tasks/:taskId/ack",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await acknowledgeWaiterTask({
          waiterId: req.staffSession!.userId,
          taskId: paramString(req.params.taskId),
        }),
      );
    }),
  );

  api.post(
    "/staff/waiter/tasks/:taskId/start",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await startWaiterTask({
          waiterId: req.staffSession!.userId,
          taskId: paramString(req.params.taskId),
        }),
      );
    }),
  );

  api.post(
    "/staff/waiter/tasks/:taskId/complete",
    requireStaffAuth({ role: "waiter" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await completeWaiterTask({
          waiterId: req.staffSession!.userId,
          taskId: paramString(req.params.taskId),
          mutationKey: typeof body.mutationKey === "string" ? body.mutationKey : undefined,
        }),
      );
    }),
  );

  api.get(
    "/staff/manager/hall",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(res, await getManagerHall(req.staffSession!.userId, getRequestOrigin(req)));
    }),
  );

  api.get(
    "/staff/manager/history",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await getManagerHistory({
          managerId: req.staffSession!.userId,
          tableId: parseOptionalInt(typeof req.query.tableId === "string" ? req.query.tableId : null),
          waiterId: typeof req.query.waiterId === "string" ? req.query.waiterId : undefined,
          type: typeof req.query.type === "string" ? req.query.type : undefined,
          cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
          limit: parseOptionalInt(typeof req.query.limit === "string" ? req.query.limit : null, 25),
        }),
      );
    }),
  );

  api
    .route("/staff/manager/layout")
    .get(
      requireStaffAuth({ role: "manager" }),
      asyncHandler(async (req, res) => {
        jsonNoStore(res, await getManagerLayout(req.staffSession!.userId));
      }),
    )
    .patch(
      requireStaffAuth({ role: "manager" }),
      asyncHandler(async (req, res) => {
        const body = bodyObject(req);
        jsonNoStore(
          res,
          await updateManagerLayout({
            managerId: req.staffSession!.userId,
            payload: {
              tables: Array.isArray(body.tables)
                ? body.tables.map((table: unknown) => ({
                  tableId: Number((table as Record<string, unknown>).tableId),
                  label: (table as Record<string, unknown>).label ? String((table as Record<string, unknown>).label) : undefined,
                  zoneId: (table as Record<string, unknown>).zoneId ? String((table as Record<string, unknown>).zoneId) : undefined,
                  x: Number((table as Record<string, unknown>).x ?? 0),
                  y: Number((table as Record<string, unknown>).y ?? 0),
                  shape:
                    (table as Record<string, unknown>).shape === "round" ||
                      (table as Record<string, unknown>).shape === "rect"
                      ? ((table as Record<string, unknown>).shape as "round" | "rect")
                      : "square",
                  sizePreset:
                    (table as Record<string, unknown>).sizePreset === "sm" ||
                      (table as Record<string, unknown>).sizePreset === "lg"
                      ? ((table as Record<string, unknown>).sizePreset as "sm" | "lg")
                      : "md",
                }))
                : [],
              zones: Array.isArray(body.zones)
                ? body.zones.map((zone: unknown) => ({
                  id: String((zone as Record<string, unknown>).id ?? ""),
                  label: String((zone as Record<string, unknown>).label ?? ""),
                  x: Number((zone as Record<string, unknown>).x ?? 0),
                  y: Number((zone as Record<string, unknown>).y ?? 0),
                  width: Number((zone as Record<string, unknown>).width ?? 0),
                  height: Number((zone as Record<string, unknown>).height ?? 0),
                }))
                : [],
            },
          }),
        );
      }),
    );

  api
    .route("/staff/manager/menu")
    .get(
      requireStaffAuth({ role: "manager" }),
      asyncHandler(async (req, res) => {
        jsonNoStore(res, await getManagerMenuSnapshot(req.staffSession!.userId));
      }),
    );

  api.post(
    "/staff/manager/menu/categories",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await createManagerMenuCategory({
          managerId: req.staffSession!.userId,
          payload: {
            labelRu: asString(body.labelRu),
            icon: typeof body.icon === "string" ? body.icon : undefined,
            sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
          },
        }),
      );
    }),
  );

  api.patch(
    "/staff/manager/menu/categories/:categoryId",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await updateManagerMenuCategory({
          managerId: req.staffSession!.userId,
          categoryId: paramString(req.params.categoryId),
          payload: {
            labelRu: asString(body.labelRu),
            icon: typeof body.icon === "string" ? body.icon : undefined,
            sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
          },
        }),
      );
    }),
  );

  api.delete(
    "/staff/manager/menu/categories/:categoryId",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await deleteManagerMenuCategory({
          managerId: req.staffSession!.userId,
          categoryId: paramString(req.params.categoryId),
        }),
      );
    }),
  );

  api.post(
    "/staff/manager/menu/dishes",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await createManagerDish({
          managerId: req.staffSession!.userId,
          payload: {
            categoryId: asString(body.categoryId),
            nameRu: asString(body.nameRu),
            nameIt: asString(body.nameIt),
            description: asString(body.description),
            price: Number(body.price ?? 0),
            image: asString(body.image),
            portion: asString(body.portion),
            energyKcal: Number(body.energyKcal ?? 0),
            badgeLabel: typeof body.badgeLabel === "string" ? body.badgeLabel : undefined,
            badgeTone:
              body.badgeTone === "gold" || body.badgeTone === "navy" || body.badgeTone === "sage" || body.badgeTone === "blush"
                ? body.badgeTone
                : undefined,
            highlight: Boolean(body.highlight),
            available: body.available !== false,
          },
        }),
      );
    }),
  );

  api.patch(
    "/staff/manager/menu/dishes/:dishId",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await updateManagerDish({
          managerId: req.staffSession!.userId,
          dishId: paramString(req.params.dishId),
          payload: {
            categoryId: asString(body.categoryId),
            nameRu: asString(body.nameRu),
            nameIt: asString(body.nameIt),
            description: asString(body.description),
            price: Number(body.price ?? 0),
            image: asString(body.image),
            portion: asString(body.portion),
            energyKcal: Number(body.energyKcal ?? 0),
            badgeLabel: typeof body.badgeLabel === "string" ? body.badgeLabel : undefined,
            badgeTone:
              body.badgeTone === "gold" || body.badgeTone === "navy" || body.badgeTone === "sage" || body.badgeTone === "blush"
                ? body.badgeTone
                : undefined,
            highlight: Boolean(body.highlight),
            available: body.available !== false,
          },
        }),
      );
    }),
  );

  api.delete(
    "/staff/manager/menu/dishes/:dishId",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await deleteManagerDish({
          managerId: req.staffSession!.userId,
          dishId: paramString(req.params.dishId),
        }),
      );
    }),
  );

  api.post(
    "/staff/manager/menu/dishes/:dishId/toggle-availability",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await toggleManagerDishAvailability({
          managerId: req.staffSession!.userId,
          dishId: paramString(req.params.dishId),
        }),
      );
    }),
  );

  api.post(
    "/staff/manager/menu/images",
    requireStaffAuth({ role: "manager" }),
    upload.single("file"),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        throw new ApiError(400, "Image file is required");
      }
      const file = new File([new Uint8Array(req.file.buffer)], req.file.originalname, {
        type: req.file.mimetype,
      });
      jsonNoStore(res, await saveManagerMenuImage(file, toFetchRequest(req)));
    }),
  );

  api.patch(
    "/staff/manager/menu/reorder",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await reorderManagerMenu({
          managerId: req.staffSession!.userId,
          categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds.filter((entry: unknown): entry is string => typeof entry === "string") : undefined,
          dishIdsByCategory:
            body.dishIdsByCategory && typeof body.dishIdsByCategory === "object" && !Array.isArray(body.dishIdsByCategory)
              ? Object.fromEntries(
                Object.entries(body.dishIdsByCategory as Record<string, unknown>).map(([key, value]) => [key, asStringArray(value)]),
              )
              : undefined,
        }),
      );
    }),
  );

  api
    .route("/staff/manager/tables")
    .post(
      requireStaffAuth({ role: "manager" }),
      asyncHandler(async (req, res) => {
        const body = bodyObject(req);
        jsonNoStore(
          res,
          await createManagerTable({
            managerId: req.staffSession!.userId,
            payload: {
              label: typeof body.label === "string" ? body.label : undefined,
              zoneId: typeof body.zoneId === "string" ? body.zoneId : undefined,
              shape: body.shape === "round" || body.shape === "rect" ? body.shape : undefined,
              sizePreset: body.sizePreset === "sm" || body.sizePreset === "md" || body.sizePreset === "lg" ? body.sizePreset : undefined,
              x: typeof body.x === "number" ? body.x : undefined,
              y: typeof body.y === "number" ? body.y : undefined,
            },
          }),
        );
      }),
    );

  api.get(
    "/staff/manager/tables/:tableId",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await getManagerTableDetail(req.staffSession!.userId, parseTableId(paramString(req.params.tableId)), getRequestOrigin(req)),
      );
    }),
  );

  api.post(
    "/staff/manager/tables/:tableId/reassign",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await reassignManagerTable({
          managerId: req.staffSession!.userId,
          tableId: parseTableId(paramString(req.params.tableId)),
          waiterId: typeof body.waiterId === "string" && body.waiterId.trim() ? body.waiterId : undefined,
          publicBaseUrl: getRequestOrigin(req),
        }),
      );
    }),
  );

  api.post(
    "/staff/manager/tables/:tableId/close",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await closeManagerTable({
          managerId: req.staffSession!.userId,
          tableId: parseTableId(paramString(req.params.tableId)),
          publicBaseUrl: getRequestOrigin(req),
        }),
      );
    }),
  );

  api.post(
    "/staff/manager/tables/:tableId/archive",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await archiveManagerTable({
          managerId: req.staffSession!.userId,
          tableId: parseTableId(paramString(req.params.tableId)),
        }),
      );
    }),
  );

  api.post(
    "/staff/manager/tables/:tableId/restore",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(
        res,
        await restoreManagerTable({
          managerId: req.staffSession!.userId,
          tableId: parseTableId(paramString(req.params.tableId)),
        }),
      );
    }),
  );

  api
    .route("/staff/manager/waiters")
    .get(
      requireStaffAuth({ role: "manager" }),
      asyncHandler(async (req, res) => {
        jsonNoStore(res, await listManagerWaiters(req.staffSession!.userId));
      }),
    )
    .post(
      requireStaffAuth({ role: "manager" }),
      asyncHandler(async (req, res) => {
        const body = bodyObject(req);
        jsonNoStore(
          res,
          await createManagerWaiter({
            managerId: req.staffSession!.userId,
            payload: {
              name: asString(body.name),
              login: asString(body.login),
              password: asString(body.password),
              tableIds: asNumberArray(body.tableIds),
            },
          }),
        );
      }),
    );

  api.get(
    "/staff/manager/waiters/:waiterId",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      jsonNoStore(res, await getManagerWaiterDetail(req.staffSession!.userId, paramString(req.params.waiterId)));
    }),
  );

  api.patch(
    "/staff/manager/waiters/:waiterId",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await updateManagerWaiter({
          managerId: req.staffSession!.userId,
          waiterId: paramString(req.params.waiterId),
          payload: {
            name: typeof body.name === "string" ? body.name : undefined,
            login: typeof body.login === "string" ? body.login : undefined,
            active: typeof body.active === "boolean" ? body.active : undefined,
          },
        }),
      );
    }),
  );

  api.post(
    "/staff/manager/waiters/:waiterId/reset-password",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await resetManagerWaiterPassword({
          managerId: req.staffSession!.userId,
          waiterId: paramString(req.params.waiterId),
          payload: {
            password: asString(body.password),
          },
        }),
      );
    }),
  );

  api.put(
    "/staff/manager/waiters/:waiterId/assignments",
    requireStaffAuth({ role: "manager" }),
    asyncHandler(async (req, res) => {
      const body = bodyObject(req);
      jsonNoStore(
        res,
        await replaceManagerWaiterAssignments({
          managerId: req.staffSession!.userId,
          waiterId: paramString(req.params.waiterId),
          payload: {
            tableIds: asNumberArray(body.tableIds),
          },
        }),
      );
    }),
  );

  api.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    sendApiError(res, error);
  });

  return api;
}
