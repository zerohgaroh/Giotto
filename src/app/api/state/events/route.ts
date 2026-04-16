import { subscribeStateEvents } from "@/lib/server-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      push("ready", { at: Date.now() });

      unsub = subscribeStateEvents((event) => {
        push(event.type, event);
      });

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      }, 15_000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsub) unsub();
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
