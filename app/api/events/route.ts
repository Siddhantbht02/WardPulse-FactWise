import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`)
      );

      // Listener for broadcast events
      const onBroadcast = ({ event, data }: { event: string; data: any }) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch (e) {
          // Client disconnected
        }
      };

      sseManager.on("broadcast", onBroadcast);

      // Keepalive ping every 25 seconds
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 25000);

      // Cleanup when connection closes
      request.signal.addEventListener("abort", () => {
        clearInterval(keepAliveInterval);
        sseManager.off("broadcast", onBroadcast);
      });
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

