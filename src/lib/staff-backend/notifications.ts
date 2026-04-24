import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { prisma } from "./prisma";
import {
  buildExpoPushMessages,
  buildFcmMulticastMessage,
  collectInvalidFcmTokens,
  selectPreferredPushTargets,
  type ExpoPushMessage,
  type WaiterServiceAlertPayload,
  type WaiterServiceAlertType,
} from "./push-delivery";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_SIZE = 100;
const EXPO_PUSH_TIMEOUT_MS = 8_000;
const EXPO_PUSH_MAX_ATTEMPTS = 3;
const EXPO_PUSH_RETRY_DELAYS_MS = [500, 1_500];
const FCM_BATCH_SIZE = 500;
const FCM_APP_NAME = "giotto-staff-fcm";

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

type FirebaseServiceAccountConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

let firebaseMessagingClient: Messaging | null | undefined;
let firebaseConfigWarningShown = false;

function createPushSendOutcome(attempted = 0): PushSendOutcome {
  return {
    attempted,
    sent: 0,
    failed: 0,
    pruned: 0,
    retried: 0,
    failureReasons: {},
  };
}

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

function mergeFailureReasons(...groups: Array<Record<string, number>>) {
  const merged: Record<string, number> = {};

  for (const group of groups) {
    for (const [reason, count] of Object.entries(group)) {
      merged[reason] = (merged[reason] ?? 0) + count;
    }
  }

  return merged;
}

function resolveExpoTicketReason(ticket: ExpoPushTicket | undefined, responseErrors?: ExpoPushResponse["errors"]) {
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

async function prunePushTokens(tokens: Set<string>) {
  if (tokens.size === 0) {
    return 0;
  }

  try {
    const deleted = await prisma.pushDevice.deleteMany({
      where: {
        token: {
          in: [...tokens],
        },
      },
    });
    return deleted.count;
  } catch (error) {
    console.warn("[push] Failed to prune stale push tokens", {
      tokens: tokens.size,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

function warnFirebaseConfig(message: string, error?: unknown) {
  if (firebaseConfigWarningShown) {
    return;
  }

  firebaseConfigWarningShown = true;
  if (error) {
    console.warn(message, error);
    return;
  }
  console.warn(message);
}

function loadFirebaseServiceAccount(): FirebaseServiceAccountConfig | null {
  const raw = process.env.GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    warnFirebaseConfig("[push] Missing GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON, skipping direct FCM delivery");
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const projectId =
      typeof parsed.project_id === "string"
        ? parsed.project_id.trim()
        : typeof parsed.projectId === "string"
          ? parsed.projectId.trim()
          : "";
    const clientEmail =
      typeof parsed.client_email === "string"
        ? parsed.client_email.trim()
        : typeof parsed.clientEmail === "string"
          ? parsed.clientEmail.trim()
          : "";
    const privateKey =
      typeof parsed.private_key === "string"
        ? parsed.private_key
        : typeof parsed.privateKey === "string"
          ? parsed.privateKey
          : "";

    if (!projectId || !clientEmail || !privateKey.trim()) {
      throw new Error("Service account JSON must contain project_id, client_email and private_key");
    }

    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  } catch (error) {
    warnFirebaseConfig("[push] Failed to parse GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON", error);
    return null;
  }
}

async function getFirebaseMessagingClient() {
  if (firebaseMessagingClient !== undefined) {
    return firebaseMessagingClient;
  }

  const serviceAccount = loadFirebaseServiceAccount();
  if (!serviceAccount) {
    firebaseMessagingClient = null;
    return null;
  }

  try {
    const app =
      getApps().find((item) => item.name === FCM_APP_NAME) ??
      initializeApp(
        {
          credential: cert({
            projectId: serviceAccount.projectId,
            clientEmail: serviceAccount.clientEmail,
            privateKey: serviceAccount.privateKey,
          }),
          projectId: serviceAccount.projectId,
        },
        FCM_APP_NAME,
      );

    firebaseMessagingClient = getMessaging(app);
    return firebaseMessagingClient;
  } catch (error) {
    warnFirebaseConfig("[push] Failed to initialize Firebase Admin for direct FCM delivery", error);
    firebaseMessagingClient = null;
    return null;
  }
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

    return (await response.json()) as ExpoPushResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<PushSendOutcome> {
  const summary = createPushSendOutcome(messages.length);
  if (messages.length === 0) {
    return summary;
  }

  const pruneTokens = new Set<string>();

  for (const batch of chunk(messages, EXPO_PUSH_BATCH_SIZE)) {
    let response: ExpoPushResponse | null = null;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= EXPO_PUSH_MAX_ATTEMPTS; attempt += 1) {
      try {
        response = await sendExpoBatch(batch);
        break;
      } catch (error) {
        lastError = error;
        if (attempt >= EXPO_PUSH_MAX_ATTEMPTS) {
          break;
        }

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
      const reason = resolveExpoTicketReason(ticket, response.errors);
      trackFailure(summary, reason);
      if (reason === "DeviceNotRegistered") {
        pruneTokens.add(batch[index].to);
      }
    }
  }

  summary.pruned = await prunePushTokens(pruneTokens);
  return summary;
}

async function sendFcmPushMessages(tokens: string[], input: WaiterServiceAlertPayload): Promise<PushSendOutcome> {
  const summary = createPushSendOutcome(tokens.length);
  if (tokens.length === 0) {
    return summary;
  }

  const messaging = await getFirebaseMessagingClient();
  if (!messaging) {
    summary.failed = tokens.length;
    trackFailure(summary, "fcm_unavailable", tokens.length);
    return summary;
  }

  const pruneTokens = new Set<string>();

  for (const batch of chunk(tokens, FCM_BATCH_SIZE)) {
    try {
      const response = await messaging.sendEachForMulticast(buildFcmMulticastMessage(batch, input));
      summary.sent += response.successCount;
      summary.failed += response.failureCount;

      response.responses.forEach((item) => {
        if (item.success) {
          return;
        }

        const reason = item.error?.code?.trim() || item.error?.message?.trim() || "unknown";
        trackFailure(summary, reason);
      });

      for (const token of collectInvalidFcmTokens(batch, response)) {
        pruneTokens.add(token);
      }
    } catch (error) {
      summary.failed += batch.length;
      trackFailure(summary, error instanceof Error ? error.message : "fcm_send_failed", batch.length);
    }
  }

  summary.pruned = await prunePushTokens(pruneTokens);
  return summary;
}

function mergeSendOutcomes(...outcomes: PushSendOutcome[]): PushSendOutcome {
  const merged = createPushSendOutcome();

  for (const outcome of outcomes) {
    merged.attempted += outcome.attempted;
    merged.sent += outcome.sent;
    merged.failed += outcome.failed;
    merged.pruned += outcome.pruned;
    merged.retried += outcome.retried;
  }

  merged.failureReasons = mergeFailureReasons(...outcomes.map((outcome) => outcome.failureReasons));
  return merged;
}

export function __resetPushDeliveryStateForTests() {
  firebaseMessagingClient = undefined;
  firebaseConfigWarningShown = false;
}

export async function pushWaiterServiceAlert(input: {
  waiterId?: string;
  tableId: number;
  type: WaiterServiceAlertType;
  reason?: string;
  itemCount?: number;
  totalAmount?: number;
}) {
  if (!input.waiterId) {
    return;
  }

  try {
    const devices = await prisma.pushDevice.findMany({
      where: { staffUserId: input.waiterId },
      orderBy: { updatedAt: "desc" },
    });
    const targets = selectPreferredPushTargets(devices);

    const [fcmOutcome, expoOutcome] = await Promise.all([
      sendFcmPushMessages(targets.fcmTokens, input),
      sendExpoPushMessages(buildExpoPushMessages(targets.expoTokens, input)),
    ]);
    const outcome = mergeSendOutcomes(fcmOutcome, expoOutcome);

    console.info("[push] waiter_service_alert_delivery", {
      waiterId: input.waiterId,
      tableId: input.tableId,
      requestType: input.type,
      fcmTargets: targets.fcmTokens.length,
      expoTargets: targets.expoTokens.length,
      attempted: outcome.attempted,
      sent: outcome.sent,
      failed: outcome.failed,
      pruned: outcome.pruned,
      retried: outcome.retried,
      fcmSent: fcmOutcome.sent,
      expoSent: expoOutcome.sent,
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
