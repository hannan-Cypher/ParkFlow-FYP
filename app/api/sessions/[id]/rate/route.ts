import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


/**
 * POST /api/sessions/[id]/rate
 *
 * Customer rates a completed parking session.
 *
 * Body:
 *   rating          (required) — integer 1–5
 *   rating_comment  (optional) — text feedback
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params;
        const body = await request.json();
        const { rating, rating_comment } = body;

        if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
            return NextResponse.json(
                { error: 'rating must be an integer between 1 and 5' },
                { status: 400 }
            );
        }

        // Verify session exists and is completed
        const sessionCheck = await pool.query(
            `SELECT id, status FROM parking_sessions WHERE id = $1`,
            [sessionId]
        );

        if (sessionCheck.rows.length === 0) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (sessionCheck.rows[0].status !== 'completed') {
            return NextResponse.json(
                { error: 'Only completed sessions can be rated' },
                { status: 400 }
            );
        }

        // Save rating
        await pool.query(
            `UPDATE parking_sessions
             SET rating = $1, rating_comment = $2
             WHERE id = $3`,
            [Math.round(rating), rating_comment?.trim() || null, sessionId]
        );

        return NextResponse.json(
            { message: 'Rating submitted successfully', rating: Math.round(rating) },
            { status: 200 }
        );
    } catch (error) {
        console.error('Rate session error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
