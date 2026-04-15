import { NextResponse } from 'next/server';
import { getNgrokPublicUrl } from '@/lib/server/ngrok';

export const dynamic = 'force-dynamic';

/**
 * GET /api/config/ngrok
 *
 * Returns the current ngrok public URL if running.
 */
export async function GET() {
    try {
        const publicUrl = await getNgrokPublicUrl();
        return NextResponse.json({ publicUrl });
    } catch (error) {
        console.error('Ngrok Config API error:', error);
        return NextResponse.json({ error: 'Failed to fetch ngrok config' }, { status: 500 });
    }
}
