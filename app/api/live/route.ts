import { NextRequest } from "next/server";
import { subscribeLiveEvents } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (data: unknown, event?: string) => {
        if (event) controller.enqueue(enc.encode(`event: ${event}\n`));
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ ok: true }, "connected");
      const ping = setInterval(() => send({ t: Date.now() }, "ping"), 15000);
      const unsubscribe = subscribeLiveEvents((event) => send(event, "update"));

      const close = () => {
        clearInterval(ping);
        unsubscribe();
      };

      // @ts-expect-error stream cancel exists at runtime
      controller.oncancel = close;
    },
    cancel() {
      // no-op; oncancel handles cleanup where available
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
