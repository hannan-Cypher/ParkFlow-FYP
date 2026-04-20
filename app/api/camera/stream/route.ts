import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const requestedVenue = searchParams.get('venue_id');

    if (!requestedVenue) {
        return new NextResponse('venue_id is required', { status: 400 });
    }

    const upstreamUrl = process.env.CAMERA_STREAM_URL || 'http://localhost:8081/video_feed';

    try {
        // Build venue URL robustly
        const baseUrl = upstreamUrl.split('/video_feed')[0].replace(/\/$/, '');
        const venueUrl = `${baseUrl}/venue`;

        // 1. Fetch current assignment from streamer
        const venueResponse = await fetch(venueUrl, {
            cache: 'no-store',
            headers: { 'ngrok-skip-browser-warning': 'true' },
            signal: request.signal,
        });

        if (!venueResponse.ok) {
            return new NextResponse('Failed to reach camera streamer for verification', { status: 502 });
        }

        const currentAssignment = await venueResponse.json();
        const activeVenueId = currentAssignment.venue_id;

        // 2. Authorization logic
        if (requestedVenue !== 'setup' && requestedVenue !== activeVenueId) {
            return new NextResponse(`Unauthorized: Camera assigned to ${currentAssignment.venue_name || 'another location'}`, { status: 403 });
        }

        // 3. Connect to MJPEG stream
        const controller = new AbortController();
        const { signal } = controller;

        // Sever the upstream connection when the client disconnects
        request.signal.addEventListener('abort', () => {
            console.log('Client disconnected from camera stream proxy, aborting upstream fetch');
            controller.abort();
        });

        const response = await fetch(upstreamUrl, {
            cache: 'no-store',
            headers: {
                'ngrok-skip-browser-warning': 'true',
                'Accept': 'multipart/x-mixed-replace; boundary=frame',
            },
            signal,
        });

        if (!response.ok || !response.body) {
            return new NextResponse(`Camera streamer error: ${response.statusText}`, { status: response.status || 502 });
        }

        // 4. Return the stream directly with zero-buffering headers
        return new NextResponse(response.body, {
            headers: {
                'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Connection': 'keep-alive',
            },
        });
    } catch (error: any) {
        if (error.name === 'AbortError') {
            return new NextResponse(null, { status: 499 }); // Client Closed Request
        }
        console.error('Camera stream proxy error:', error);
        return new NextResponse('Failed to connect to camera streamer. Ensure python model/camera_streamer.py is running.', { status: 502 });
    }
}
