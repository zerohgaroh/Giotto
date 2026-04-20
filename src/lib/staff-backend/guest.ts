import { prisma } from "./prisma";
import { pushWaiterCallNotification, pushWaiterServiceAlert } from "./notifications";
import { ApiError, ensureActiveSession, getAssignedWaiterId, toCooldownState } from "./projections";
import { ensureStaffBackendReady } from "./seed";
import { appendActivityEvents, publishActivityEvents } from "./activity";
import type { CooldownState, Review, ServiceRequestType, WaiterOrderInput } from "./types";

export async function getGuestRequestCooldown(input: {
  tableId: number;
  type: ServiceRequestType;
}): Promise<CooldownState> {
  await ensureStaffBackendReady();

  const session = await prisma.tableSession.findFirst({
    where: {
      tableId: input.tableId,
      closedAt: null,
    },
    orderBy: { startedAt: "desc" },
  });

  const availableAt =
    input.type === "bill"
      ? session?.billCooldownUntil?.getTime() ?? 0
      : session?.waiterCooldownUntil?.getTime() ?? 0;

  return toCooldownState(input.type, availableAt, Date.now());
}

export async function createGuestRequest(input: {
  tableId: number;
  type: ServiceRequestType;
  reason?: string;
}): Promise<{ cooldown: CooldownState; accepted: boolean }> {
  await ensureStaffBackendReady();

  const reason =
    input.reason?.trim() || (input.type === "bill" ? "Guests are ready to pay" : "Guests requested a waiter");

  const now = new Date();
  let waiterId: string | undefined;
  let availableAt = now.getTime() + 120_000;
  let accepted = false;
  let tableSessionId = "";
  let serviceRequestId = "";

  await prisma.$transaction(async (tx) => {
    const table = await tx.restaurantTable.findUnique({
      where: { id: input.tableId },
      include: {
        assignments: {
          where: { endedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { waiter: true },
        },
      },
    });

    if (!table || table.archivedAt) {
      throw new ApiError(404, "Table not found");
    }

    waiterId = getAssignedWaiterId({
      ...table,
      sessions: [],
    });

    const session = await ensureActiveSession(input.tableId, tx, now);
    tableSessionId = session.id;
    const currentAvailableAt =
      input.type === "bill"
        ? session.billCooldownUntil?.getTime() ?? 0
        : session.waiterCooldownUntil?.getTime() ?? 0;

    if (currentAvailableAt > now.getTime()) {
      availableAt = currentAvailableAt;
      return;
    }

    accepted = true;
    availableAt = now.getTime() + 120_000;

    await tx.tableSession.update({
      where: { id: session.id },
      data:
        input.type === "bill"
          ? { billCooldownUntil: new Date(availableAt) }
          : { waiterCooldownUntil: new Date(availableAt) },
    });

    const existing = await tx.serviceRequest.findFirst({
      where: {
        tableSessionId: session.id,
        type: input.type,
        resolvedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!existing) {
      const created = await tx.serviceRequest.create({
        data: {
          tableSessionId: session.id,
          tableId: input.tableId,
          type: input.type,
          reason,
          createdAt: now,
        },
      });
      serviceRequestId = created.id;

      await tx.waiterTask.create({
        data: {
          tableSessionId: session.id,
          tableId: input.tableId,
          waiterId: waiterId ?? null,
          type: input.type === "bill" ? "bill_request" : "waiter_call",
          priority: "urgent",
          status: "open",
          sourceRequestId: created.id,
          title: input.type === "bill" ? "Bring the bill" : "Guest needs a waiter",
          subtitle: reason,
          createdAt: now,
        },
      });
    }
  });

  const cooldown = toCooldownState(input.type, availableAt, Date.now());

  if (accepted) {
    const events = await appendActivityEvents([
      {
        type: input.type === "bill" ? "bill:requested" : "waiter:called",
        actorRole: "guest",
        actorId: "guest",
        tableId: input.tableId,
        tableSessionId,
        payload: {
          reason,
          cooldownAvailableAt: availableAt,
        },
      },
      {
        type: "table:status_changed",
        actorRole: "system",
        actorId: "system",
        tableId: input.tableId,
        tableSessionId,
        payload: { to: input.type === "bill" ? "bill" : "waiting" },
      },
      ...(serviceRequestId
        ? [
            {
              type: "task:created" as const,
              actorRole: "system" as const,
              actorId: waiterId,
              tableId: input.tableId,
              tableSessionId,
              payload: {
                waiterId,
                sourceRequestId: serviceRequestId,
                status: "open",
              },
            },
            {
              type: "shift:summary_changed" as const,
              actorRole: "system" as const,
              actorId: waiterId,
              tableId: input.tableId,
              tableSessionId,
              payload: { waiterId },
            },
          ]
        : []),
    ]);
    publishActivityEvents(events);

    await pushWaiterCallNotification({
      waiterId,
      tableId: input.tableId,
      type: input.type,
      reason,
    });
  }

  return { cooldown, accepted };
}

export async function submitGuestOrder(input: {
  tableId: number;
  items: WaiterOrderInput[];
}): Promise<{ ok: true }> {
  await ensureStaffBackendReady();

  const validItems = input.items
    .map((item) => ({
      dishId: item.dishId,
      title: String(item.title ?? "").trim(),
      qty: Math.max(0, Math.floor(Number(item.qty ?? 0))),
      price: Math.max(0, Math.floor(Number(item.price ?? 0))),
      note: item.note?.trim() || undefined,
    }))
    .filter((item) => item.title && item.qty > 0);

  if (validItems.length === 0) {
    throw new ApiError(400, "Cart is empty");
  }

  const now = new Date();
  let tableSessionId = "";
  let waiterId: string | undefined;

  await prisma.$transaction(async (tx) => {
    const table = await tx.restaurantTable.findUnique({
      where: { id: input.tableId },
      include: {
        assignments: {
          where: { endedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { waiter: true },
        },
      },
    });
    if (!table || table.archivedAt) {
      throw new ApiError(404, "Table not found");
    }

    waiterId = getAssignedWaiterId({
      ...table,
      sessions: [],
    });

    const session = await ensureActiveSession(input.tableId, tx, now);
    tableSessionId = session.id;
    await tx.billLine.createMany({
      data: validItems.map((item) => ({
        tableSessionId: session.id,
        tableId: input.tableId,
        dishId: item.dishId,
        title: item.title,
        qty: item.qty,
        price: item.price,
        note: item.note,
        source: "guest",
        createdAt: now,
      })),
    });
  });

  const itemCount = validItems.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = validItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const events = await appendActivityEvents([
    {
      type: "order:submitted_by_guest",
      actorRole: "guest",
      actorId: "guest",
      tableId: input.tableId,
      tableSessionId,
      payload: {
        lines: validItems.length,
        itemCount,
        totalAmount,
      },
    },
    {
      type: "table:status_changed",
      actorRole: "system",
      actorId: "system",
      tableId: input.tableId,
      tableSessionId,
      payload: { to: "ordered", action: "guest_order_submitted" },
    },
  ]);
  publishActivityEvents(events);

  await pushWaiterServiceAlert({
    waiterId,
    tableId: input.tableId,
    type: "order",
    itemCount,
    totalAmount,
  });

  return { ok: true };
}

export async function submitGuestReview(input: {
  tableId: number;
  rating: number;
  comment?: string;
}): Promise<Review> {
  await ensureStaffBackendReady();
  const rating = Math.max(1, Math.min(5, Math.floor(input.rating)));
  const now = new Date();

  const prompt = await prisma.reviewPrompt.findFirst({
    where: {
      tableId: input.tableId,
      resolvedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!prompt) {
    throw new ApiError(409, "Review prompt is not active");
  }

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.guestReview.create({
      data: {
        tableSessionId: prompt.tableSessionId,
        tableId: input.tableId,
        waiterId: prompt.waiterId,
        rating,
        comment: input.comment?.trim() || undefined,
        createdAt: now,
      },
    });

    await tx.reviewPrompt.update({
      where: { id: prompt.id },
      data: { resolvedAt: now },
    });

    return created;
  });

  const events = await appendActivityEvents([
    {
      type: "review:submitted",
      actorRole: "guest",
      actorId: "guest",
      tableId: input.tableId,
      tableSessionId: prompt.tableSessionId,
      payload: {
        rating,
        waiterId: review.waiterId,
      },
    },
  ]);
  publishActivityEvents(events);

  return {
    tableId: review.tableId,
    waiterId: review.waiterId ?? undefined,
    rating: review.rating,
    comment: review.comment ?? undefined,
    createdAt: review.createdAt.getTime(),
  };
}
