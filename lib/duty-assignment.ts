// ── Staff Duty Assignment Logic ─────────────────────────────────────────────
// Handles validation and business rules for assigning staff to zones/venues.

import { isStaffRole, isAdminLike, isOperationalStaff } from './roles';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AssignmentInput {
    staff_id: string;
    staff_role: string;      // role of the staff member being assigned
    venue_id: string | null;
    zone_id: string | null;  // only for driver/washer
    caller_role: string;     // role of the person making the assignment
}

export interface AssignmentValidation {
    valid: boolean;
    error?: string;
    resolved_venue_id: string | null;
    resolved_zone_id: string | null;
}

// ── Permission Check ────────────────────────────────────────────────────────

/**
 * Checks if a caller has permission to assign a given staff role.
 *
 * - Admin can assign any staff role (driver/washer/supervisor)
 * - Supervisor can assign driver/washer but NOT supervisor
 * - All other roles cannot assign anyone
 */
export function canAssignRole(callerRole: string, targetStaffRole: string): boolean {
    if (callerRole === 'admin') {
        return isStaffRole(targetStaffRole);
    }

    if (callerRole === 'supervisor') {
        return isOperationalStaff(targetStaffRole);
    }

    return false;
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates a duty assignment request according to business rules:
 *
 * 1. staff_id is required
 * 2. The staff member must be a staff role (driver/washer/supervisor)
 * 3. Caller must have permission to assign the target role
 * 4. Supervisors are assigned to venues only (zone_id is cleared)
 * 5. Drivers/washers can be assigned to zones by admin or supervisor
 * 6. If zone_id is provided for a driver/washer, venue_id must also be provided
 * 7. Unassigning (null venue + null zone) is always valid for any staff role
 */
export function validateAssignment(input: AssignmentInput): AssignmentValidation {
    const { staff_id, staff_role, venue_id, zone_id, caller_role } = input;

    // 1. staff_id is required
    if (!staff_id) {
        return { valid: false, error: 'staff_id is required', resolved_venue_id: null, resolved_zone_id: null };
    }

    // 2. Must be a staff role
    if (!isStaffRole(staff_role)) {
        return { valid: false, error: 'Target user is not a staff member', resolved_venue_id: null, resolved_zone_id: null };
    }

    // 3. Permission check
    if (!canAssignRole(caller_role, staff_role)) {
        if (staff_role === 'supervisor') {
            return { valid: false, error: 'Only admin can assign supervisors', resolved_venue_id: null, resolved_zone_id: null };
        }
        return { valid: false, error: 'No permission to assign staff', resolved_venue_id: null, resolved_zone_id: null };
    }

    // 4. Supervisor → venue only, zone is cleared
    if (staff_role === 'supervisor') {
        return {
            valid: true,
            resolved_venue_id: venue_id,
            resolved_zone_id: null,  // always null for supervisors
        };
    }

    // 5-7. Driver/Washer
    // If zone provided without venue → invalid
    if (zone_id && !venue_id) {
        return { valid: false, error: 'Venue is required when assigning a zone', resolved_venue_id: null, resolved_zone_id: null };
    }

    return {
        valid: true,
        resolved_venue_id: venue_id,
        resolved_zone_id: zone_id,
    };
}
