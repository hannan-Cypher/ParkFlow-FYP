import { NextRequest } from 'next/server';
import { realtimeManager } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            let isClosed = false;

            const safeEnqueue = (chunk: string) => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(chunk));
                } catch (e) {
                    cleanup();
                }
            };

            const handler = (event: unknown) => {
                safeEnqueue(`data: ${JSON.stringify(event)}\n\n`);
            };

            const cleanup = () => {
                if (isClosed) return;
                isClosed = true;
                realtimeManager.unsubscribe(handler);
                if (heartbeat) clearInterval(heartbeat);
                try { controller.close(); } catch (e) { }
            };

            // Register with the shared singleton listener (uses 0 extra DB connections)
            realtimeManager.subscribe(handler);

            // Heartbeat to keep the SSE connection alive through proxies
            const heartbeat = setInterval(() => {
                safeEnqueue(': heartbeat\n\n');
            }, 30000);

            // Clean up when the client disconnects
            req.signal.addEventListener('abort', cleanup);
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
