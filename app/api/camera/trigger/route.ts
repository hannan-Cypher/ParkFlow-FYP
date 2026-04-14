import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const upstreamUrl = 'http://localhost:8081/trigger_snapshot';
        const response = await fetch(upstreamUrl, {
            method: 'POST',
            cache: 'no-store',
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
