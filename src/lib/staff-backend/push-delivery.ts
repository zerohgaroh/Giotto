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
  sentAt?: number;
};

export type ExpoPushMessage = {
  to: string;
  priority: "high";
  ttl: number;
  data: Record<string, unknown>;
  _contentAvailable?: boolean;
};

export type FcmMulticastMessage = {
  tokens: string[];
  data?: Record<string, string>;
  android?: {
    priority?: "normal" | "high";
    ttl?: number;
    collapseKey?: string;
  };
};

export type FcmBatchItemResponseLike = {
  success: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

export type FcmBatchResponseLike = {
  responses: FcmBatchItemResponseLike[];
  successCount?: number;
  failureCount?: number;
};

export const NOTIFICATION_CHANNEL_ID = "giotto-service-alerts-v3";
export const NOTIFICATION_SOUND_FILENAME = "waiter_alert_alarm.wav";
export const ANDROID_ALERT_VIBRATION_PATTERN = [0, 550, 220, 850, 220, 1200];
export const WAITER_ALERT_TTL_SEC = 60;
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

function normalizeAlertReason(requestType: WaiterServiceAlertType, reason?: string) {
  const normalized = typeof reason === "string" ? reason.trim() : "";
  if (!normalized) return "";

  const canonical = normalized.replace(/\.+$/u, "").trim().toLowerCase();
  if (canonical === "guests requested a waiter") {
    return "Гости ждут официанта.";
  }
  if (canonical === "guests are ready to pay") {
    return "Гости готовы оплатить заказ.";
  }
  if (canonical === "new order from guest cart") {
    return "Гости отправили заказ из корзины.";
  }
  if (/^\d+\s+items?\s+from guest cart$/u.test(canonical)) {
    return "Гости отправили заказ из корзины.";
  }

  return normalized;
}

export function buildWaiterAlertCollapseKey(input: WaiterServiceAlertPayload) {
  return `waiter:${input.tableId}:${input.type}`;
}

export function getServiceAlertCopy(input: WaiterServiceAlertPayload) {
  const normalizedReason = normalizeAlertReason(input.type, input.reason);

  if (input.type === "bill") {
    return {
      title: `Стол ${input.tableId} просит счёт`,
      body: normalizedReason || "Гости готовы оплатить заказ.",
    };
  }

  if (input.type === "order") {
    return {
      title: `Стол ${input.tableId} оформил заказ`,
      body: normalizedReason || (input.itemCount ? `${input.itemCount} поз. из корзины гостя.` : "Гости отправили заказ из корзины."),
    };
  }

  return {
    title: `Стол ${input.tableId} вызывает официанта`,
    body: normalizedReason || "Гости ждут официанта.",
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
  if (typeof input.sentAt === "number" && Number.isFinite(input.sentAt) && input.sentAt > 0) {
    data.sentAt = String(Math.floor(input.sentAt));
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

function buildAndroidPresentationData(
  input: WaiterServiceAlertPayload,
  presentationMode: "native-data-only" | "local-task",
) {
  const copy = getServiceAlertCopy(input);
  const alertData = buildWaiterAlertData(input);
  const collapseKey = buildWaiterAlertCollapseKey(input);

  return {
    ...alertData,
    title: copy.title,
    message: copy.body,
    body: JSON.stringify(alertData),
    sound: NOTIFICATION_SOUND_FILENAME,
    channelId: NOTIFICATION_CHANNEL_ID,
    vibrate: JSON.stringify(ANDROID_ALERT_VIBRATION_PATTERN),
    tag: collapseKey,
    presentationMode,
  };
}

export function buildExpoPushMessages(tokens: string[], input: WaiterServiceAlertPayload): ExpoPushMessage[] {
  const data = buildAndroidPresentationData(input, "local-task");

  return tokens.map((token) => ({
    to: token,
    priority: "high",
    ttl: WAITER_ALERT_TTL_SEC,
    data,
    _contentAvailable: true,
  }));
}

export function buildFcmMulticastMessage(tokens: string[], input: WaiterServiceAlertPayload): FcmMulticastMessage {
  const collapseKey = buildWaiterAlertCollapseKey(input);

  return {
    tokens,
    data: buildAndroidPresentationData(input, "native-data-only"),
    android: {
      priority: "high",
      ttl: WAITER_ALERT_TTL_MS,
      collapseKey,
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
    if (!deviceId && fcmTokens.length > 0) {
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

export function collectInvalidFcmTokens(tokens: string[], response: Pick<FcmBatchResponseLike, "responses">) {
  const invalidTokens: string[] = [];

  response.responses.forEach((item: FcmBatchItemResponseLike, index: number) => {
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
