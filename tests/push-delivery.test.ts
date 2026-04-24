import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/lib/staff-backend/prisma";
import {
  buildWaiterAlertCollapseKey,
  buildFcmMulticastMessage,
  collectInvalidFcmTokens,
  selectPreferredPushTargets,
} from "../src/lib/staff-backend/push-delivery";
import {
  __resetPushDeliveryStateForTests,
  pushWaiterServiceAlert,
  verifyPushDeliveryStartup,
} from "../src/lib/staff-backend/notifications";
import { registerPushDevice } from "../src/lib/staff-backend/waiter";

test("selectPreferredPushTargets prefers native Android FCM tokens over Expo tokens for the same device", () => {
  const targets = selectPreferredPushTargets([
    {
      token: "fcm-device-1-new",
      platform: "android",
      deviceId: "device-1",
    },
    {
      token: "ExpoPushToken[device-1-old]",
      platform: "expo",
      deviceId: "device-1",
    },
    {
      token: "fcm-device-1-old",
      platform: "android",
      deviceId: "device-1",
    },
    {
      token: "ExpoPushToken[device-2]",
      platform: "expo",
      deviceId: "device-2",
    },
    {
      token: "ExpoPushToken[device-2]",
      platform: "expo",
      deviceId: "device-2",
    },
    {
      token: "ExpoPushToken[legacy-android-token]",
      platform: "expo",
    },
    {
      token: "fcm-without-device-id",
      platform: "android",
    },
  ]);

  assert.deepEqual(targets, {
    fcmTokens: ["fcm-device-1-new", "fcm-without-device-id"],
    expoTokens: ["ExpoPushToken[device-2]"],
  });
});

test("buildFcmMulticastMessage stringifies payload data and keeps Android high-priority channel config", () => {
  const message = buildFcmMulticastMessage(["fcm-token-1"], {
    tableId: 7,
    type: "order",
    itemCount: 3,
    totalAmount: 45000,
    sentAt: 1_700_000_000_000,
  });

  assert.deepEqual(message.tokens, ["fcm-token-1"]);
  assert.equal(message.notification?.title, "Стол 7 оформил заказ");
  assert.equal(message.data?.tableId, "7");
  assert.equal(message.data?.requestType, "order");
  assert.equal(message.data?.itemCount, "3");
  assert.equal(message.data?.totalAmount, "45000");
  assert.equal(message.data?.sentAt, "1700000000000");
  assert.equal(message.android?.priority, "high");
  assert.equal(message.android?.ttl, 60_000);
  assert.equal(message.android?.collapseKey, buildWaiterAlertCollapseKey({ tableId: 7, type: "order" }));
  assert.equal(message.android?.notification?.channelId, "giotto-service-alerts");
  assert.equal(message.android?.notification?.tag, buildWaiterAlertCollapseKey({ tableId: 7, type: "order" }));
});

test("collectInvalidFcmTokens returns only invalid or unregistered device tokens", () => {
  const invalidTokens = collectInvalidFcmTokens(["fcm-1", "fcm-2", "fcm-3"], {
    responses: [
      {
        success: false,
        error: { code: "messaging/registration-token-not-registered" },
      },
      {
        success: false,
        error: { code: "messaging/invalid-registration-token" },
      },
      {
        success: false,
        error: { code: "messaging/server-unavailable" },
      },
    ],
  } as never);

  assert.deepEqual(invalidTokens, ["fcm-1", "fcm-2"]);
});

test("pushWaiterServiceAlert soft-fails when Firebase credentials are missing", async () => {
  const pushDeviceModel = prisma.pushDevice as {
    findMany: typeof prisma.pushDevice.findMany;
    deleteMany: typeof prisma.pushDevice.deleteMany;
  };
  const originalFindMany = pushDeviceModel.findMany;
  const originalDeleteMany = pushDeviceModel.deleteMany;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const previousFirebaseConfig = process.env.GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON;

  const warnings: unknown[][] = [];
  pushDeviceModel.findMany = (async () => [
    {
      token: "fcm-token-1",
      platform: "android",
      deviceId: "device-1",
      updatedAt: new Date(),
    },
  ]) as typeof prisma.pushDevice.findMany;
  pushDeviceModel.deleteMany = (async () => ({ count: 0 })) as typeof prisma.pushDevice.deleteMany;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  console.info = () => {};
  delete process.env.GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON;
  __resetPushDeliveryStateForTests();

  try {
    await pushWaiterServiceAlert({
      waiterId: "waiter-1",
      tableId: 5,
      type: "waiter",
    });
  } finally {
    pushDeviceModel.findMany = originalFindMany;
    pushDeviceModel.deleteMany = originalDeleteMany;
    console.warn = originalWarn;
    console.info = originalInfo;
    __resetPushDeliveryStateForTests();
    if (previousFirebaseConfig === undefined) {
      delete process.env.GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON;
    } else {
      process.env.GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON = previousFirebaseConfig;
    }
  }

  assert.ok(
    warnings.some((entry) => String(entry[0] ?? "").includes("GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON")),
    "expected missing Firebase credentials warning",
  );
});

test("verifyPushDeliveryStartup reports disabled when Firebase credentials are missing", async () => {
  const previousFirebaseConfig = process.env.GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON;
  __resetPushDeliveryStateForTests();
  delete process.env.GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON;

  try {
    const result = await verifyPushDeliveryStartup();
    assert.deepEqual(result, {
      status: "disabled",
      provider: "fcm",
      reason: "missing_env",
      message: "GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON is missing",
    });
  } finally {
    __resetPushDeliveryStateForTests();
    if (previousFirebaseConfig === undefined) {
      delete process.env.GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON;
    } else {
      process.env.GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON = previousFirebaseConfig;
    }
  }
});

test("registerPushDevice clears stale tokens for the same app installation before upserting", async () => {
  const pushDeviceModel = prisma.pushDevice as {
    deleteMany: typeof prisma.pushDevice.deleteMany;
    upsert: typeof prisma.pushDevice.upsert;
  };
  const originalDeleteMany = pushDeviceModel.deleteMany;
  const originalUpsert = pushDeviceModel.upsert;

  const deleteManyCalls: unknown[] = [];
  const upsertCalls: unknown[] = [];

  pushDeviceModel.deleteMany = (async (args: unknown) => {
    deleteManyCalls.push(args);
    return { count: 1 };
  }) as typeof prisma.pushDevice.deleteMany;
  pushDeviceModel.upsert = ((async (args: unknown) => {
    upsertCalls.push(args);
    return {} as never;
  }) as unknown) as typeof prisma.pushDevice.upsert;

  try {
    await registerPushDevice(
      { userId: "waiter-1" },
      {
        token: "  fcm-token-new  ",
        platform: "android",
        deviceId: "  device-1  ",
        appVersion: "  1.0.0  ",
      },
    );
  } finally {
    pushDeviceModel.deleteMany = originalDeleteMany;
    pushDeviceModel.upsert = originalUpsert;
  }

  assert.deepEqual(deleteManyCalls, [
    {
      where: {
        deviceId: "device-1",
        NOT: {
          token: "fcm-token-new",
        },
      },
    },
    {
      where: {
        staffUserId: "waiter-1",
        platform: "expo",
        deviceId: null,
      },
    },
  ]);
  assert.deepEqual(upsertCalls, [
    {
      where: { token: "fcm-token-new" },
      update: {
        staffUserId: "waiter-1",
        platform: "android",
        deviceId: "device-1",
        appVersion: "1.0.0",
      },
      create: {
        staffUserId: "waiter-1",
        token: "fcm-token-new",
        platform: "android",
        deviceId: "device-1",
        appVersion: "1.0.0",
      },
    },
  ]);
});
