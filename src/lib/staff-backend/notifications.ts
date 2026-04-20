import { prisma } from "./prisma";
import type { ServiceRequestType } from "./types";

export type WaiterServiceAlertType = ServiceRequestType | "order";

async function sendExpoPushMessages(messages: Array<Record<string, unknown>>) {
  if (messages.length === 0) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });
  } catch {
    // Notification delivery must not block service actions.
  }
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

  const devices = await prisma.pushDevice.findMany({
    where: { staffUserId: input.waiterId },
    orderBy: { updatedAt: "desc" },
  });

  const copy = getServiceAlertCopy(input);

  const messages = devices
    .filter((device) => device.token.startsWith("ExponentPushToken") || device.token.startsWith("ExpoPushToken"))
    .map((device) => ({
      to: device.token,
      sound: "default",
      priority: "high",
      channelId: "default",
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

  await sendExpoPushMessages(messages);
}

export const pushWaiterCallNotification = pushWaiterServiceAlert;
