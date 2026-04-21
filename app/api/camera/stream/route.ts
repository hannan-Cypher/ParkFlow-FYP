import { NextResponse } from 'next/server';

// Force Next.js not to cache or buffer this infinite stream route
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 3600; // Allow long-running streams (1 hour)

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const requestedVenue = searchParams.get('venue_id');
    const requestedGate = searchParams.get('gate_id');

    if (!requestedVenue) {
        return new NextResponse('venue_id is required', { status: 400 });
    }

    const isRaw = searchParams.get('raw') === 'true';

    let upstreamUrl = process.env.CAMERA_STREAM_URL || 'http://localhost:8081/video_feed';
    if (isRaw) {
        upstreamUrl = upstreamUrl.replace('/video_feed', '/video_feed_raw');
    }
    console.log(`[CameraProxy] Connecting to upstream: ${upstreamUrl} for venue: ${requestedVenue}, gate: ${requestedGate} (Raw: ${isRaw})`);

    try {
        // Build venue URL robustly
        const baseUrl = upstreamUrl.split('/video_feed')[0].replace(/\/$/, '');
        const venueUrl = `${baseUrl}/venue`;

        // 1. Fetch current assignment from streamer
        console.log(`[CameraProxy] Verifying venue at: ${venueUrl}`);
        const venueResponse = await fetch(venueUrl, {
            cache: 'no-store',
            headers: { 'ngrok-skip-browser-warning': 'true' },
            signal: request.signal,
        });

        if (!venueResponse.ok) {
            console.error(`[CameraProxy] Venue check failed (${venueResponse.status}) at: ${venueUrl}`);
            return new NextResponse(`Failed to reach camera streamer at ${venueUrl} for verification. Status: ${venueResponse.status}`, { status: 502 });
        }

        const currentAssignment = await venueResponse.json();
        const activeVenueId = currentAssignment.venue_id;
        const activeGateId = currentAssignment.gate_id;
        console.log(`[CameraProxy] Streamer is currently assigned to venue: ${activeVenueId}, gate: ${activeGateId}`);

        // 2. Authorization logic
        const isSetup = requestedVenue === 'setup' || requestedGate === 'setup';

        if (!isSetup) {
            if (requestedVenue !== activeVenueId) {
                console.warn(`[CameraProxy] Venue mismatch. Requested: ${requestedVenue}, Active: ${activeVenueId}`);
                return new NextResponse(`Unauthorized: Camera assigned to ${currentAssignment.venue_name || 'another location'}`, { status: 403 });
            }
            if (requestedGate && requestedGate !== activeGateId) {
                console.warn(`[CameraProxy] Gate mismatch. Requested: ${requestedGate}, Active: ${activeGateId}`);
                return new NextResponse(`Unauthorized: Camera assigned to another gate`, { status: 403 });
            }
        }

        // 3. Connect to MJPEG stream
        const controller = new AbortController();
        const { signal } = controller;

        // Sever the upstream connection when the client disconnects
        request.signal.addEventListener('abort', () => {
            console.log('[CameraProxy] Client disconnected, aborting upstream fetch');
            controller.abort();
        });

        console.log(`[CameraProxy] Proxying stream from: ${upstreamUrl}`);
        const response = await fetch(upstreamUrl, {
            cache: 'no-store',
            headers: {
                'ngrok-skip-browser-warning': 'true',
                'Accept': 'multipart/x-mixed-replace; boundary=frame',
                'Cache-Control': 'no-cache',
            },
            signal,
            // Bypass Next.js internal fetch patched defaults for streaming
            // @ts-ignore
            duplex: 'half',
        });

        if (!response.ok || !response.body) {
            console.error(`[CameraProxy] Upstream MJPEG fetch failed (${response.status}): ${response.statusText}`);
            return new NextResponse(`Camera streamer error at ${upstreamUrl}: ${response.statusText}`, { status: response.status || 502 });
        }

        // 4. Return the stream directly with native Response to avoid Next.js caching bugs
        return new Response(response.body, {
            status: 200,
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'multipart/x-mixed-replace; boundary=frame',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Connection': 'keep-alive',
                'Transfer-Encoding': 'chunked',
            },
        });
    } catch (error: any) {
        if (error.name === 'AbortError' || error.message?.includes('abort')) {
            console.log('[CameraProxy] Upstream fetch aborted normally due to client disconnect.');
            return new Response(null, { status: 499 }); // Client Closed Request
        }
        console.error('[CameraProxy] Unexpected error:', error);
        return new Response(`Failed to connect to camera streamer at ${upstreamUrl}. Error: ${error.message}`, { status: 502 });
    }
}
