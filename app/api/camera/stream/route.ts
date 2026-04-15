import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const upstreamUrl = process.env.CAMERA_STREAM_URL || 'http://localhost:8081/video_feed';
        const response = await fetch(upstreamUrl, {
            cache: 'no-store',
            headers: {
                'ngrok-skip-browser-warning': 'true',
            },
        });


        if (!response.ok) {
            return new NextResponse(`Camera streamer error: ${response.statusText}`, { status: response.status });
        }

        // Pipe the MJPEG stream directly to the client
        return new NextResponse(response.body, {
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'multipart/x-mixed-replace; boundary=frame',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (error) {
        console.error('Camera stream proxy error:', error);
        return new NextResponse('Failed to connect to camera streamer. Ensure python model/camera_streamer.py is running.', { status: 502 });
    }
}
