import { NextRequest } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const client = await pool.connect();

            const sendEvent = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            // Handle PostgreSQL notifications
            client.on('notification', (msg) => {
                if (msg.channel === 'realtime_updates' && msg.payload) {
                    try {
                        const payload = JSON.parse(msg.payload);
                        sendEvent(payload);
                    } catch (e) {
                        console.error('Failed to parse PG notification payload', e);
                    }
                }
            });

            // Start listening
            await client.query('LISTEN realtime_updates');

            // Keep connection alive with a heartbeat
            const heartbeat = setInterval(() => {
                controller.enqueue(encoder.encode(': heartbeat\n\n'));
            }, 30000);

            // Clean up on close
            req.signal.addEventListener('abort', () => {
                clearInterval(heartbeat);
                client.query('UNLISTEN realtime_updates');
                client.release();
                controller.close();
            });
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
