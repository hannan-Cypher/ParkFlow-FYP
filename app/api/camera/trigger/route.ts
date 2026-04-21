import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { venue_id, gate_id } = body;

        const upstreamUrl = process.env.CAMERA_STREAM_URL
            ? process.env.CAMERA_STREAM_URL.replace('/video_feed', '/trigger_snapshot')
            : 'http://localhost:8081/trigger_snapshot';

        console.log(`[TriggerProxy] Manual trigger requested for venue: ${venue_id}, gate: ${gate_id}`);

        const response = await fetch(upstreamUrl, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify({ venue_id, gate_id }),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Camera trigger proxy error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to connect to camera streamer' },
            { status: 502 }
        );
    }
}
