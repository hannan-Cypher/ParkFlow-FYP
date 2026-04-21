import { NextRequest } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const client = await pool.connect();
            let isClosed = false;
            let heartbeat: NodeJS.Timeout;

            const safeClose = () => {
                if (isClosed) return;
                isClosed = true;
                if (heartbeat) clearInterval(heartbeat);
                try {
                    client.query('UNLISTEN realtime_updates').catch(() => { });
                } catch (e) { }
                try {
                    client.release();
                } catch (e) { }
                try {
                    controller.close();
                } catch (e) { }
            };

            const sendEvent = (data: any) => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch (e) {
                    safeClose();
                }
            };

            // Handle PostgreSQL notifications
            client.on('notification', (msg) => {
                if (isClosed) return;
                if (msg.channel === 'realtime_updates' && msg.payload) {
                    try {
                        const payload = JSON.parse(msg.payload);
                        sendEvent(payload);
                    } catch (e) {
                        console.error('Failed to parse PG notification payload', e);
                    }
                }
            });

            try {
                // Start listening
                await client.query('LISTEN realtime_updates');

                // Keep connection alive with a heartbeat
                heartbeat = setInterval(() => {
                    if (isClosed) return;
                    try {
                        controller.enqueue(encoder.encode(': heartbeat\n\n'));
                    } catch (e) {
                        safeClose();
                    }
                }, 30000);

                // Clean up on close
                req.signal.addEventListener('abort', safeClose);
            } catch (e) {
                console.error('SSE setup error', e);
                safeClose();
            }
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
