import { prisma } from "./prisma";
import type { ServiceRequestType } from "./types";

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

export async function pushWaiterCallNotification(input: {
  waiterId?: string;
  tableId: number;
  type: ServiceRequestType;
  reason: string;
}) {
  if (!input.waiterId) return;

  const devices = await prisma.pushDevice.findMany({
    where: { staffUserId: input.waiterId },
    orderBy: { updatedAt: "desc" },
  });

  const title = input.type === "bill" ? `Table ${input.tableId} - Bill requested` : `Table ${input.tableId} - Waiter requested`;

  const messages = devices
    .filter((device) => device.token.startsWith("ExponentPushToken") || device.token.startsWith("ExpoPushToken"))
    .map((device) => ({
      to: device.token,
      sound: "default",
      title,
      body: input.reason,
      data: {
        tableId: input.tableId,
        screen: "WaiterTable",
        requestType: input.type,
      },
    }));

  await sendExpoPushMessages(messages);
}
