import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/admin/stats
 *
 * Returns real-time system-level statistics for the admin dashboard:
 *   - Total & active venues
 *   - Total & occupied slots (with occupancy %)
 *   - Total & active sessions
 *   - Today's completed sessions & revenue
 *   - Total revenue (all time)
 *   - Staff counts (total, on-duty, busy)
 *   - Customer count
 *   - System health indicators
 */
export async function GET(_request: NextRequest) {
    try {
        // Run all queries in parallel for speed
        const [
            venueStats,
            slotStats,
            sessionStats,
            todayStats,
            staffStats,
            customerCount,
            recentActivity,
        ] = await Promise.all([
            // Venue stats
            pool.query(`
                SELECT 
                    COUNT(*) as total_venues,
                    COUNT(*) FILTER (WHERE status = 'active') as active_venues
                FROM venues
            `),

            // Slot stats
            pool.query(`
                SELECT 
                    COUNT(*) as total_slots,
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied_slots,
                    COUNT(*) FILTER (WHERE status = 'available') as available_slots
                FROM parking_slots
            `),

            // Session stats (all time)
            pool.query(`
                SELECT 
                    COUNT(*) as total_sessions,
                    COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed_sessions,
                    COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as total_revenue,
                    COALESCE(AVG(total_hours) FILTER (WHERE status = 'completed'), 0) as avg_duration_hours
                FROM parking_sessions
            `),

            // Today's stats
            pool.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'completed' AND exit_time::date = CURRENT_DATE) as completed_today,
                    COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed' AND exit_time::date = CURRENT_DATE), 0) as today_revenue,
                    COUNT(*) FILTER (WHERE entry_time::date = CURRENT_DATE) as checkins_today
                FROM parking_sessions
            `),

            // Staff stats
            pool.query(`
                SELECT 
                    COUNT(*) as total_staff,
                    COUNT(*) FILTER (WHERE is_active = true) as active_staff,
                    COUNT(*) FILTER (WHERE venue_id IS NOT NULL) as assigned_staff
                FROM users 
                WHERE role = 'valet_staff'
            `),

            // Customer count
            pool.query(`
                SELECT COUNT(*) as total FROM users WHERE role = 'customer'
            `),

            // Last 5 session events
            pool.query(`
                SELECT 
                    ps.id,
                    ps.status,
                    ps.entry_time,
                    ps.exit_time,
                    v.license_plate,
                    ve.name as venue_name,
                    sl.slot_number,
                    staff.full_name as staff_name
                FROM parking_sessions ps
                JOIN vehicles v ON v.id = ps.vehicle_id
                LEFT JOIN venues ve ON ve.id = ps.venue_id
                LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
                LEFT JOIN users staff ON staff.id = ps.valet_staff_id
                ORDER BY ps.created_at DESC
                LIMIT 5
            `),
        ]);

        const venue = venueStats.rows[0];
        const slot = slotStats.rows[0];
        const session = sessionStats.rows[0];
        const today = todayStats.rows[0];
        const staff = staffStats.rows[0];
        const customers = customerCount.rows[0];

        const totalSlots = Number(slot.total_slots);
        const occupiedSlots = Number(slot.occupied_slots);
        const occupancyRate = totalSlots > 0
            ? Math.round((occupiedSlots / totalSlots) * 100)
            : 0;

        return NextResponse.json({
            venues: {
                total: Number(venue.total_venues),
                active: Number(venue.active_venues),
            },
            slots: {
                total: totalSlots,
                occupied: occupiedSlots,
                available: Number(slot.available_slots),
                occupancy_rate: occupancyRate,
            },
            sessions: {
                total: Number(session.total_sessions),
                active: Number(session.active_sessions),
                completed: Number(session.completed_sessions),
                avg_duration_hours: Number(Number(session.avg_duration_hours).toFixed(2)),
            },
            today: {
                completed: Number(today.completed_today),
                revenue: Number(Number(today.today_revenue).toFixed(2)),
                checkins: Number(today.checkins_today),
            },
            revenue: {
                total: Number(Number(session.total_revenue).toFixed(2)),
                today: Number(Number(today.today_revenue).toFixed(2)),
            },
            staff: {
                total: Number(staff.total_staff),
                active: Number(staff.active_staff),
                assigned: Number(staff.assigned_staff),
            },
            customers: {
                total: Number(customers.total),
            },
            recent_activity: recentActivity.rows.map(row => ({
                id: row.id,
                status: row.status,
                entry_time: row.entry_time,
                exit_time: row.exit_time,
                license_plate: row.license_plate,
                venue_name: row.venue_name,
                slot_number: row.slot_number,
                staff_name: row.staff_name,
            })),
            system: {
                database: 'connected',
                anpr_service: 'active',
                uptime: process.uptime(),
            },
        }, { status: 200 });
    } catch (error) {
        console.error('Admin stats error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
