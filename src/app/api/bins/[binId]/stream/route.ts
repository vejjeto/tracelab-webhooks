import { subscribeToBin } from "@/core/sse-broker";
import { getRequestId } from "@/lib/problem-details";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ binId: string }> };

function encodeSseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

export async function GET(req: Request, context: RouteContext) {
  const requestId = getRequestId(req);
  const { binId } = await context.params;
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      safeEnqueue(
        encodeSseEvent("connected", {
          binId,
          connectedAt: new Date().toISOString(),
        }),
      );

      const unsubscribe = subscribeToBin(binId, (captured) => {
        safeEnqueue(encodeSseEvent("request:captured", captured));
      });

      const keepaliveTimer = setInterval(() => {
        safeEnqueue(encoder.encode(": keepalive\n\n"));
      }, 15_000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepaliveTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      };

      req.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "x-request-id": requestId,
    },
  });
}
