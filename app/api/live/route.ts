import { NextRequest } from "next/server";
import { subscribeLiveEvents } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  let ping: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (ping) clearInterval(ping);
    if (unsubscribe) unsubscribe();
  };

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (data: unknown, event?: string) => {
        if (closed) return;
        try {
          if (event) controller.enqueue(enc.encode(`event: ${event}\n`));
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      send({ ok: true }, "connected");
      ping = setInterval(() => send({ t: Date.now() }, "ping"), 15000);
      unsubscribe = subscribeLiveEvents((event) => send(event, "update"));
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
