import { noStoreJson } from "@/lib/staff-backend/http";
import { applyWaiterAssignmentChange, canWaiterReceiveRealtimeEvent } from "@/lib/staff-backend/realtime-access";
import { getWaiterById } from "@/lib/staff-backend/auth";
import { requireStaffSession } from "@/lib/staff-backend/request-auth";
import { subscribeRealtimeEvents } from "@/lib/waiter-backend/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let allowedTableIds: Set<number> | null = null;
  let waiterId: string | null = null;

  try {
    const session = await requireStaffSession(request, { allowQuery: true });
    if (session.role === "waiter") {
      waiterId = session.userId;
      const waiter = await getWaiterById(session.userId);
      if (!waiter) {
        throw new Error("Unauthorized");
      }
      allowedTableIds = new Set(waiter.tableIds);
    }
  } catch (error) {
    return noStoreJson(
      {
        error: error instanceof Error ? error.message : "Unauthorized",
      },
      401,
    );
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      push("ready", { at: Date.now() });

      unsubscribe = subscribeRealtimeEvents((event) => {
        applyWaiterAssignmentChange(waiterId, allowedTableIds, event);

        if (!canWaiterReceiveRealtimeEvent(waiterId, allowedTableIds, event)) {
          return;
        }
        push(event.type, event);
      });

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      }, 15_000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
