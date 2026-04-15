import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const upstreamUrl = process.env.CAMERA_STREAM_URL
            ? process.env.CAMERA_STREAM_URL.replace('/video_feed', '/venue')
            : 'http://localhost:8081/venue';

        const response = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            return new NextResponse(`Camera streamer error: ${response.statusText}`, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Camera venue proxy error:', error);
        return new NextResponse('Failed to connect to camera streamer.', { status: 502 });
    }
}
