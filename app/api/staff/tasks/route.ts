import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/staff/tasks
 *
 * Returns the task queue for a specific staff member.
 * Query params:
 *   staff_id — UUID of the staff member (required)
 *   status   — 'active' | 'completed' | 'all' (default: 'active')
 *
 * Tasks are derived from parking_sessions assigned to this staff member.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const staffId = searchParams.get('staff_id')
        const status = searchParams.get('status') || 'active'

        if (!staffId) {
            return NextResponse.json(
                { error: 'staff_id is required' },
                { status: 400 }
            )
        }

        // Verify staff member exists
        const staffCheck = await pool.query(
            "SELECT id, full_name, venue_id FROM users WHERE id = $1 AND role = 'valet_staff'",
            [staffId]
        )

        let statusFilter = ''
        const queryParams: (string | null)[] = [staffId]

        if (status === 'active') {
            statusFilter = "AND ps.status = 'active'"
        } else if (status === 'completed') {
            statusFilter = "AND ps.status = 'completed'"
        }
        // 'all' = no filter

        const result = await pool.query(
            `SELECT 
        ps.id,
        ps.status,
        ps.retrieval_status,
        ps.entry_time,
        ps.exit_time,
        ps.rate_per_hour,
        ps.total_amount,
        ps.total_hours,
        ps.damage_photos,
        ps.damage_notes,
        ps.staff_notes,
        ps.customer_notes,
        v.id as vehicle_id,
        v.license_plate,
        v.make,
        v.model,
        v.color,
        v.vehicle_type,
        ve.id as venue_id,
        ve.name as venue_name,
        sl.slot_number,
        sl.floor_level,
        sl.zone,
        sl.slot_type,
        cu.full_name as customer_name,
        cu.phone as customer_phone,
        CASE 
          WHEN ps.status = 'active' THEN
            EXTRACT(EPOCH FROM (NOW() - ps.entry_time)) / 3600
          ELSE ps.total_hours
        END as duration_hours
      FROM parking_sessions ps
      JOIN vehicles v ON v.id = ps.vehicle_id
      LEFT JOIN venues ve ON ve.id = ps.venue_id
      LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
      LEFT JOIN users cu ON cu.id = ps.customer_id
      WHERE ps.valet_staff_id = $1 ${statusFilter}
      ORDER BY 
        CASE WHEN ps.status = 'active' THEN 0 ELSE 1 END,
        ps.entry_time DESC
      LIMIT 50`,
            queryParams
        )

        const tasks = result.rows.map((row) => {
            const durationHours = Number(row.duration_hours) || 0
            const h = Math.floor(durationHours)
            const m = Math.round((durationHours - h) * 60)
            const durationDisplay = h > 0 ? `${h}h ${m}m` : `${m}m`

            return {
                id: row.id,
                type: row.status === 'active' ? 'check_in' : 'completed',
                status: row.status,
                retrieval_status: row.retrieval_status || null,
                priority: row.status === 'active' ? 'high' : 'normal',
                entry_time: row.entry_time,
                exit_time: row.exit_time,
                duration: durationDisplay,
                duration_hours: durationHours,
                vehicle: {
                    id: row.vehicle_id,
                    license_plate: row.license_plate,
                    make: row.make,
                    model: row.model,
                    color: row.color,
                    vehicle_type: row.vehicle_type,
                },
                venue: {
                    id: row.venue_id,
                    name: row.venue_name,
                },
                slot: {
                    slot_number: row.slot_number,
                    floor_level: row.floor_level,
                    zone: row.zone,
                    slot_type: row.slot_type,
                },
                customer: {
                    name: row.customer_name,
                    phone: row.customer_phone,
                },
                billing: {
                    rate_per_hour: Number(row.rate_per_hour),
                    total_amount: row.total_amount ? Number(row.total_amount) : null,
                },
                damage_photos: row.damage_photos || [],
                damage_notes: row.damage_notes,
                staff_notes: row.staff_notes,
                customer_notes: row.customer_notes,
            }
        })

        // Get stats
        const statsResult = await pool.query(
            `SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'completed' AND exit_time::date = CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE status = 'completed') as total_completed,
        COALESCE(AVG(total_hours) FILTER (WHERE status = 'completed'), 0) as avg_duration
      FROM parking_sessions
      WHERE valet_staff_id = $1`,
            [staffId]
        )

        const stats = statsResult.rows[0]

        return NextResponse.json({
            tasks,
            stats: {
                active_tasks: Number(stats.active_count),
                completed_today: Number(stats.completed_today),
                total_completed: Number(stats.total_completed),
                avg_duration_hours: Number(Number(stats.avg_duration).toFixed(2)),
            },
        })
    } catch (error) {
        console.error('Staff tasks error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
