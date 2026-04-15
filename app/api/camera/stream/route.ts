import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const requestedVenue = searchParams.get('venue_id');

        if (!requestedVenue) {
            return new NextResponse('venue_id is required', { status: 400 });
        }

        const upstreamUrl = process.env.CAMERA_STREAM_URL || 'http://localhost:8081/video_feed';
        const venueUrl = upstreamUrl.replace('/video_feed', '/venue');

        // 1. Fetch current assignment from streamer
        const venueResponse = await fetch(venueUrl, {
            cache: 'no-store',
            headers: { 'ngrok-skip-browser-warning': 'true' },
        });

        if (!venueResponse.ok) {
            return new NextResponse('Failed to reach camera streamer for verification', { status: 502 });
        }

        const currentAssignment = await venueResponse.json();
        const activeVenueId = currentAssignment.venue_id;

        // 2. Implementation logic for isolation:
        // - Always allow if requestedVenue is 'setup' (for the setup page to show unassigned cameras)
        // - Always allow if it matches the active venue
        // - Deny otherwise
        if (requestedVenue !== 'setup' && requestedVenue !== activeVenueId) {
            return new NextResponse(`Unauthorized: Camera assigned to ${currentAssignment.venue_name || 'another location'}`, { status: 403 });
        }

        // 3. Proceed with streaming if authorized
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
