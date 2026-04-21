import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


/**
 * Helper to ping the AI microservice health endpoint
 */
async function getAIStatus(): Promise<string> {
    const aiUrl = process.env.FLASK_AI_URL || 'http://127.0.0.1:8081';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
        const response = await fetch(`${aiUrl}/health`, {
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);
        return response.ok ? 'active' : 'offline';
    } catch (error) {
        clearTimeout(timeoutId);
        return 'offline';
    }
}

export async function GET(_request: NextRequest) {
    let dbStatus = 'connected';
    let anprStatus = 'offline';

    try {
        // Run AI health check and DB queries in parallel
        const aiStatusPromise = getAIStatus();

        let dbResults;
        try {
            dbResults = await Promise.all([
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
                    WHERE role IN ('driver', 'washer', 'supervisor')
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
            anprStatus = await aiStatusPromise;
        } catch (dbError) {
            console.error('Database connection error in stats:', dbError);
            dbStatus = 'disconnected';
            anprStatus = await aiStatusPromise;

            // Return fallback data with disconnected status
            return NextResponse.json({
                venues: { total: 0, active: 0 },
                slots: { total: 0, occupied: 0, available: 0, occupancy_rate: 0 },
                sessions: { total: 0, active: 0, completed: 0, avg_duration_hours: 0 },
                today: { completed: 0, revenue: 0, checkins: 0 },
                revenue: { total: 0, today: 0 },
                staff: { total: 0, active: 0, assigned: 0 },
                customers: { total: 0 },
                recent_activity: [],
                system: {
                    database: 'disconnected',
                    anpr_service: anprStatus,
                    uptime: process.uptime(),
                },
            }, { status: 200 });
        }

        const [
            venueStats,
            slotStats,
            sessionStats,
            todayStats,
            staffStats,
            customerCount,
            recentActivity,
        ] = dbResults;

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
                anpr_service: anprStatus,
                uptime: process.uptime(),
            },
        }, { status: 200 });
    } catch (error) {
        console.error('Admin stats global error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

