import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * POST /api/notify/sms
 *
 * Dispatch an SMS to the customer after check-in with QR code + session link.
 * Currently a STUB — logs to console and records in notifications table.
 * Replace the "SEND SMS" section below with a real provider (Twilio, Nexmo, etc.)
 *
 * Body:
 *   phone       (required) — customer phone number
 *   session_id  (required) — parking session UUID
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { phone, session_id } = body

        if (!phone || !session_id) {
            return NextResponse.json(
                { error: 'phone and session_id are required' },
                { status: 400 }
            )
        }

        // Fetch session details to build the SMS text
        const sessionResult = await pool.query(
            `SELECT
                ps.id,
                ps.qr_code,
                v.license_plate,
                sl.slot_number,
                sl.floor_level,
                sl.zone,
                ve.name AS venue_name
             FROM parking_sessions ps
             JOIN vehicles v ON v.id = ps.vehicle_id
             LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
             LEFT JOIN venues ve ON ve.id = ps.venue_id
             WHERE ps.id = $1`,
            [session_id]
        )

        if (sessionResult.rows.length === 0) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        const session = sessionResult.rows[0]
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const sessionLink = `${appUrl}/customer`

        const slotInfo = [
            session.slot_number,
            session.floor_level ? `Floor ${session.floor_level}` : null,
            session.zone ? `Zone ${session.zone}` : null,
        ]
            .filter(Boolean)
            .join(', ')

        const smsText =
            `ParkFlow: Your vehicle ${session.license_plate} is parked at ` +
            `${session.venue_name} — Slot ${slotInfo}. ` +
            `View & request retrieval: ${sessionLink}`

        // ── SEND SMS ────────────────────────────────────────────────────────────
        // STUB: replace this block with a real SMS provider integration.
        // Example with Twilio:
        //   const twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN)
        //   await twilioClient.messages.create({ to: phone, from: process.env.TWILIO_FROM, body: smsText })
        //
        // For now, log to console so behaviour is visible during development.
        console.log(`[SMS STUB] ▶ To: ${phone}`)
        console.log(`[SMS STUB]   Message: ${smsText}`)
        // ── END SEND SMS ────────────────────────────────────────────────────────

        // Record the sent notification so we have an audit trail
        await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, related_session_id)
             SELECT u.id,
                    'Parking Confirmation',
                    $1,
                    'sms_sent',
                    $2
             FROM users u
             WHERE u.phone = $3
               AND u.role = 'customer'
             LIMIT 1`,
            [smsText, session_id, phone]
        )

        return NextResponse.json({
            success: true,
            stub: true,
            phone,
            message: smsText,
            note: 'SMS provider not connected — message logged to console only',
        })
    } catch (error) {
        console.error('SMS notify error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
