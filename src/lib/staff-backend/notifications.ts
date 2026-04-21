import { prisma } from "./prisma";
import type { ServiceRequestType } from "./types";

export type WaiterServiceAlertType = ServiceRequestType | "order";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_SIZE = 100;
const EXPO_PUSH_TIMEOUT_MS = 8_000;
const EXPO_PUSH_MAX_ATTEMPTS = 3;
const EXPO_PUSH_RETRY_DELAYS_MS = [500, 1_500];

type ExpoPushMessage = {
  to: string;
  sound: "default";
  priority: "high";
  channelId: string;
  ttl: number;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type ExpoPushTicket = {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type ExpoPushResponse = {
  data?: ExpoPushTicket[];
  errors?: Array<{ code?: string; message?: string }>;
};

type PushSendOutcome = {
  attempted: number;
  sent: number;
  failed: number;
  pruned: number;
  retried: number;
  failureReasons: Record<string, number>;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function trackFailure(summary: PushSendOutcome, reason: string, count = 1) {
  const normalized = reason.trim() || "unknown";
  summary.failureReasons[normalized] = (summary.failureReasons[normalized] ?? 0) + count;
}

function resolveTicketReason(ticket: ExpoPushTicket | undefined, responseErrors?: ExpoPushResponse["errors"]) {
  const detailsError = ticket?.details?.error;
  if (typeof detailsError === "string" && detailsError.trim()) {
    return detailsError.trim();
  }

  if (typeof ticket?.message === "string" && ticket.message.trim()) {
    return ticket.message.trim();
  }

  const fallback = responseErrors?.[0];
  if (typeof fallback?.code === "string" && fallback.code.trim()) {
    return fallback.code.trim();
  }
  if (typeof fallback?.message === "string" && fallback.message.trim()) {
    return fallback.message.trim();
  }

  return "unknown";
}

async function sendExpoBatch(batch: ExpoPushMessage[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXPO_PUSH_TIMEOUT_MS);

  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(batch),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`expo_http_${response.status}`);
    }

    const payload = (await response.json()) as ExpoPushResponse;
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<PushSendOutcome> {
  const summary: PushSendOutcome = {
    attempted: messages.length,
    sent: 0,
    failed: 0,
    pruned: 0,
    retried: 0,
    failureReasons: {},
  };

  if (messages.length === 0) {
    return summary;
  }

  const pruneTokens = new Set<string>();
  const batches = chunk(messages, EXPO_PUSH_BATCH_SIZE);

  for (const batch of batches) {
    let response: ExpoPushResponse | null = null;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= EXPO_PUSH_MAX_ATTEMPTS; attempt += 1) {
      try {
        response = await sendExpoBatch(batch);
        break;
      } catch (error) {
        lastError = error;
        if (attempt >= EXPO_PUSH_MAX_ATTEMPTS) break;

        summary.retried += 1;
        const retryDelay = EXPO_PUSH_RETRY_DELAYS_MS[Math.min(attempt - 1, EXPO_PUSH_RETRY_DELAYS_MS.length - 1)];
        console.warn("[push] Expo send failed, retrying batch", {
          attempt,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
        await wait(retryDelay);
      }
    }

    if (!response) {
      summary.failed += batch.length;
      trackFailure(summary, lastError instanceof Error ? lastError.message : "network_error", batch.length);
      continue;
    }

    const tickets = Array.isArray(response.data) ? response.data : [];
    for (let index = 0; index < batch.length; index += 1) {
      const ticket = tickets[index];
      if (ticket?.status === "ok") {
        summary.sent += 1;
        continue;
      }

      summary.failed += 1;
      const reason = resolveTicketReason(ticket, response.errors);
      trackFailure(summary, reason);
      if (reason === "DeviceNotRegistered") {
        pruneTokens.add(batch[index].to);
      }
    }
  }

  if (pruneTokens.size > 0) {
    try {
      const deleted = await prisma.pushDevice.deleteMany({
        where: {
          token: {
            in: [...pruneTokens],
          },
        },
      });
      summary.pruned = deleted.count;
    } catch (error) {
      console.warn("[push] Failed to prune stale push tokens", {
        tokens: pruneTokens.size,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}

function getServiceAlertCopy(input: {
  tableId: number;
  type: WaiterServiceAlertType;
  reason?: string;
  itemCount?: number;
  totalAmount?: number;
}) {
  if (input.type === "bill") {
    return {
      title: `Table ${input.tableId} - Bill requested`,
      body: input.reason || "Guests are ready to pay",
    };
  }

  if (input.type === "order") {
    const itemText = input.itemCount ? `${input.itemCount} item${input.itemCount === 1 ? "" : "s"}` : "New order";
    return {
      title: `Table ${input.tableId} - New order`,
      body: input.reason || `${itemText} from guest cart.`,
    };
  }

  return {
    title: `Table ${input.tableId} - Waiter requested`,
    body: input.reason || "Guests requested a waiter",
  };
}

export async function pushWaiterServiceAlert(input: {
  waiterId?: string;
  tableId: number;
  type: WaiterServiceAlertType;
  reason?: string;
  itemCount?: number;
  totalAmount?: number;
}) {
  if (!input.waiterId) return;

  try {
    const devices = await prisma.pushDevice.findMany({
      where: { staffUserId: input.waiterId },
      orderBy: { updatedAt: "desc" },
    });

    const copy = getServiceAlertCopy(input);
    const messages: ExpoPushMessage[] = devices
      .filter((device) => device.token.startsWith("ExponentPushToken") || device.token.startsWith("ExpoPushToken"))
      .map((device) => ({
        to: device.token,
        sound: "default",
        priority: "high",
        channelId: "giotto-service-alerts",
        ttl: 300,
        title: copy.title,
        body: copy.body,
        data: {
          tableId: input.tableId,
          screen: "WaiterTable",
          requestType: input.type,
          itemCount: input.itemCount,
          totalAmount: input.totalAmount,
        },
      }));

    const outcome = await sendExpoPushMessages(messages);
    console.info("[push] waiter_service_alert_delivery", {
      waiterId: input.waiterId,
      tableId: input.tableId,
      requestType: input.type,
      attempted: outcome.attempted,
      sent: outcome.sent,
      failed: outcome.failed,
      pruned: outcome.pruned,
      retried: outcome.retried,
      failureReasons: outcome.failureReasons,
    });
  } catch (error) {
    // Notification delivery must never block service actions.
    console.warn("[push] waiter_service_alert_delivery_failed", {
      waiterId: input.waiterId,
      tableId: input.tableId,
      requestType: input.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const pushWaiterCallNotification = pushWaiterServiceAlert;
