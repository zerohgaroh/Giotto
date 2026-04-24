import type { BatchResponse, MulticastMessage } from "firebase-admin/messaging";
import type { PushPlatform, ServiceRequestType } from "./types";

export type WaiterServiceAlertType = ServiceRequestType | "order";

export type PushDeviceRecord = {
  token: string;
  platform: PushPlatform;
  deviceId?: string | null;
  updatedAt?: Date | null;
};

export type WaiterServiceAlertPayload = {
  tableId: number;
  type: WaiterServiceAlertType;
  reason?: string;
  itemCount?: number;
  totalAmount?: number;
  traceId?: string;
};

export type ExpoPushMessage = {
  to: string;
  sound: "default";
  priority: "high";
  channelId: string;
  ttl: number;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

export const NOTIFICATION_CHANNEL_ID = "giotto-service-alerts";
export const WAITER_ALERT_TTL_SEC = 300;
export const WAITER_ALERT_TTL_MS = WAITER_ALERT_TTL_SEC * 1_000;

const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const INVALID_FCM_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

function normalizeToken(input: string) {
  return input.trim();
}

export function previewPushToken(input: string) {
  const token = normalizeToken(input);
  if (!token) return "(empty)";
  if (token.length <= 22) return token;
  return `${token.slice(0, 14)}...${token.slice(-8)}`;
}

function normalizeDeviceId(input: string | null | undefined) {
  const normalized = input?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return String(Math.max(0, Math.floor(value)));
}

export function isExpoPushToken(value: string) {
  return EXPO_PUSH_TOKEN_PATTERN.test(normalizeToken(value));
}

export function getServiceAlertCopy(input: WaiterServiceAlertPayload) {
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

export function buildWaiterAlertData(input: WaiterServiceAlertPayload) {
  const data: Record<string, string> = {
    tableId: String(input.tableId),
    screen: "WaiterTable",
    requestType: input.type,
  };

  if (typeof input.traceId === "string" && input.traceId.trim()) {
    data.traceId = input.traceId.trim();
  }

  const itemCount = normalizeOptionalNumber(input.itemCount);
  if (itemCount) {
    data.itemCount = itemCount;
  }

  const totalAmount = normalizeOptionalNumber(input.totalAmount);
  if (totalAmount) {
    data.totalAmount = totalAmount;
  }

  return data;
}

export function buildExpoPushMessages(tokens: string[], input: WaiterServiceAlertPayload): ExpoPushMessage[] {
  const copy = getServiceAlertCopy(input);

  return tokens.map((token) => ({
    to: token,
    sound: "default",
    priority: "high",
    channelId: NOTIFICATION_CHANNEL_ID,
    ttl: WAITER_ALERT_TTL_SEC,
    title: copy.title,
    body: copy.body,
    data: buildWaiterAlertData(input),
  }));
}

export function buildFcmMulticastMessage(tokens: string[], input: WaiterServiceAlertPayload): MulticastMessage {
  const copy = getServiceAlertCopy(input);

  return {
    tokens,
    notification: {
      title: copy.title,
      body: copy.body,
    },
    data: buildWaiterAlertData(input),
    android: {
      priority: "high",
      ttl: WAITER_ALERT_TTL_MS,
      notification: {
        channelId: NOTIFICATION_CHANNEL_ID,
        sound: "default",
      },
    },
  };
}

export function selectPreferredPushTargets(devices: PushDeviceRecord[]) {
  const fcmTokens: string[] = [];
  const expoTokens: string[] = [];
  const seenFcmTargets = new Set<string>();
  const seenExpoTargets = new Set<string>();
  const nativeAndroidDeviceIds = new Set<string>();

  for (const device of devices) {
    const token = normalizeToken(device.token);
    if (!token || device.platform !== "android" || isExpoPushToken(token)) {
      continue;
    }

    const deviceId = normalizeDeviceId(device.deviceId);
    const dedupeKey = deviceId ? `device:${deviceId}` : `token:${token}`;
    if (seenFcmTargets.has(dedupeKey)) {
      continue;
    }

    seenFcmTargets.add(dedupeKey);
    if (deviceId) {
      nativeAndroidDeviceIds.add(deviceId);
    }
    fcmTokens.push(token);
  }

  for (const device of devices) {
    const token = normalizeToken(device.token);
    if (!token || !isExpoPushToken(token)) {
      continue;
    }

    const deviceId = normalizeDeviceId(device.deviceId);
    if (deviceId && nativeAndroidDeviceIds.has(deviceId)) {
      continue;
    }

    const dedupeKey = deviceId ? `device:${deviceId}` : `token:${token}`;
    if (seenExpoTargets.has(dedupeKey)) {
      continue;
    }

    seenExpoTargets.add(dedupeKey);
    expoTokens.push(token);
  }

  return {
    fcmTokens,
    expoTokens,
  };
}

export function collectInvalidFcmTokens(tokens: string[], response: Pick<BatchResponse, "responses">) {
  const invalidTokens: string[] = [];

  response.responses.forEach((item, index) => {
    if (item.success) {
      return;
    }

    const code = item.error?.code?.trim();
    if (code && INVALID_FCM_TOKEN_CODES.has(code)) {
      invalidTokens.push(tokens[index]);
    }
  });

  return invalidTokens;
}
