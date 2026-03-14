import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';

/**
 * GET /api/customers/lookup?phone=xxx
 * GET /api/customers/lookup?plate=LEA-1234
 * GET /api/customers/lookup?phone=xxx&plate=LEA-1234
 *
 * Look up a customer by phone and/or vehicle plate.
 * Used by staff during check-in to identify returning customers.
 *
 * Auth: admin | valet_staff only
 */
export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'admin' && user.role !== 'valet_staff') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawPhone = searchParams.get('phone')?.trim() || null;
    const rawPlate = searchParams.get('plate')?.trim() || null;

    if (!rawPhone && !rawPlate) {
      return NextResponse.json(
        { error: 'At least one of phone or plate is required' },
        { status: 400 }
      );
    }

    let customerRow: Record<string, unknown> | null = null;
    let vehicleRow: Record<string, unknown> | null = null;
    let matchedByPhone = false; // true only when phone directly matched a user

    // ── Phone lookup ──────────────────────────────────────────────────────
    if (rawPhone) {
      // Normalise the phone to try multiple stored formats
      const digits = rawPhone.replace(/\D/g, '');

      // Build three candidate phone strings for DB matching
      // $1 = cleaned digits as-is
      // $2 = local format (0xxxxxxxxxx)
      // $3 = international format (92xxxxxxxxxx)
      let localFmt = digits;
      let intlFmt = digits;

      if (digits.startsWith('92') && digits.length === 12) {
        localFmt = '0' + digits.slice(2);
        intlFmt = digits;
      } else if (digits.startsWith('0') && digits.length === 11) {
        localFmt = digits;
        intlFmt = '92' + digits.slice(1);
      } else if (digits.length === 10 && digits.startsWith('3')) {
        localFmt = '0' + digits;
        intlFmt = '92' + digits;
      }

      const phoneResult = await pool.query(
        `SELECT
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.created_at,
          (SELECT COUNT(*)
           FROM parking_sessions ps
           WHERE ps.customer_id = u.id) AS total_visits,
          (SELECT COUNT(*)
           FROM parking_sessions ps
           WHERE ps.customer_id = u.id AND ps.status = 'active') AS active_sessions,
          (SELECT MAX(entry_time)
           FROM parking_sessions ps
           WHERE ps.customer_id = u.id) AS last_visit
         FROM users u
         WHERE (u.phone = $1 OR u.phone = $2 OR u.phone = $3)
           AND u.role = 'customer'
         LIMIT 1`,
        [digits, localFmt, intlFmt]
      );

      if (phoneResult.rows.length > 0) {
        customerRow = phoneResult.rows[0];
        matchedByPhone = true;
      }
    }

    // ── Plate lookup ──────────────────────────────────────────────────────
    if (rawPlate) {
      // Normalize: uppercase + replace spaces with hyphens
      const plate = rawPlate.toUpperCase().replace(/\s+/g, "-").trim();

      const plateResult = await pool.query(
        `SELECT
          v.id              AS vehicle_id,
          v.license_plate,
          v.make,
          v.model,
          v.color,
          v.year,
          v.vehicle_type,
          v.owner_id,
          u.id              AS customer_id,
          u.full_name       AS customer_full_name,
          u.phone           AS customer_phone,
          (SELECT COUNT(*)
           FROM parking_sessions ps
           JOIN vehicles veh ON ps.vehicle_id = veh.id
           WHERE UPPER(veh.license_plate) = $1) AS plate_visit_count
         FROM vehicles v
         LEFT JOIN users u ON v.owner_id = u.id
         WHERE UPPER(v.license_plate) = $1
         LIMIT 1`,
        [plate]
      );

      if (plateResult.rows.length > 0) {
        vehicleRow = plateResult.rows[0];

        // If no customer found via phone, try to use the vehicle owner
        if (!customerRow && vehicleRow && vehicleRow.customer_id) {
          const ownerResult = await pool.query(
            `SELECT
              u.id,
              u.full_name,
              u.email,
              u.phone,
              u.role,
              u.created_at,
              (SELECT COUNT(*)
               FROM parking_sessions ps
               WHERE ps.customer_id = u.id) AS total_visits,
              (SELECT COUNT(*)
               FROM parking_sessions ps
               WHERE ps.customer_id = u.id AND ps.status = 'active') AS active_sessions,
              (SELECT MAX(entry_time)
               FROM parking_sessions ps
               WHERE ps.customer_id = u.id) AS last_visit
             FROM users u
             WHERE u.id = $1 AND u.role = 'customer'
             LIMIT 1`,
            [vehicleRow!.owner_id]
          );
          if (ownerResult.rows.length > 0) {
            customerRow = ownerResult.rows[0];
          }
        }
      }
    }

    // ── Build response ────────────────────────────────────────────────────
    const found = !!(customerRow || vehicleRow);
    const isReturning =
      found &&
      (Number(customerRow?.total_visits ?? 0) > 0 ||
        Number(vehicleRow?.plate_visit_count ?? 0) > 0);

    return NextResponse.json({
      found,
      isReturning,
      matchedByPhone,
      customer: customerRow
        ? {
            id: customerRow.id,
            full_name: customerRow.full_name,
            email: customerRow.email,
            phone: customerRow.phone,
            total_visits: Number(customerRow.total_visits ?? 0),
            active_sessions: Number(customerRow.active_sessions ?? 0),
            last_visit: customerRow.last_visit ?? null,
          }
        : null,
      vehicle: vehicleRow
        ? {
            id: vehicleRow.vehicle_id,
            license_plate: vehicleRow.license_plate,
            make: vehicleRow.make ?? null,
            model: vehicleRow.model ?? null,
            color: vehicleRow.color ?? null,
            year: vehicleRow.year ?? null,
            vehicle_type: vehicleRow.vehicle_type ?? 'car',
          }
        : null,
    });
  } catch (error) {
    console.error('Customer lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
