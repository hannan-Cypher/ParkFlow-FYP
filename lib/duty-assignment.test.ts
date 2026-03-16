import { validateAssignment, canAssignRole, AssignmentInput } from './duty-assignment';

// ─── canAssignRole ──────────────────────────────────────────────────────────

describe('canAssignRole', () => {
    // Admin permissions
    it('admin can assign driver', () => {
        expect(canAssignRole('admin', 'driver')).toBe(true);
    });

    it('admin can assign washer', () => {
        expect(canAssignRole('admin', 'washer')).toBe(true);
    });

    it('admin can assign supervisor', () => {
        expect(canAssignRole('admin', 'supervisor')).toBe(true);
    });

    // Supervisor permissions
    it('supervisor can assign driver', () => {
        expect(canAssignRole('supervisor', 'driver')).toBe(true);
    });

    it('supervisor can assign washer', () => {
        expect(canAssignRole('supervisor', 'washer')).toBe(true);
    });

    it('supervisor CANNOT assign supervisor', () => {
        expect(canAssignRole('supervisor', 'supervisor')).toBe(false);
    });

    // Non-admin roles
    it('driver cannot assign anyone', () => {
        expect(canAssignRole('driver', 'driver')).toBe(false);
        expect(canAssignRole('driver', 'washer')).toBe(false);
    });

    it('washer cannot assign anyone', () => {
        expect(canAssignRole('washer', 'driver')).toBe(false);
    });

    it('customer cannot assign anyone', () => {
        expect(canAssignRole('customer', 'driver')).toBe(false);
    });
});

// ─── validateAssignment ─────────────────────────────────────────────────────

describe('validateAssignment', () => {
    // ── Missing required fields ──────────────────────────────────────────────

    it('rejects when staff_id is empty', () => {
        const input: AssignmentInput = {
            staff_id: '',
            staff_role: 'driver',
            venue_id: 'venue-1',
            zone_id: 'zone-1',
            caller_role: 'admin',
        };
        const result = validateAssignment(input);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/staff_id/i);
    });

    it('rejects when staff_role is not a staff role', () => {
        const input: AssignmentInput = {
            staff_id: 'user-1',
            staff_role: 'customer',
            venue_id: 'venue-1',
            zone_id: null,
            caller_role: 'admin',
        };
        const result = validateAssignment(input);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/staff/i);
    });

    // ── Permission checks ────────────────────────────────────────────────────

    it('rejects supervisor assignment when caller is NOT admin', () => {
        const input: AssignmentInput = {
            staff_id: 'user-1',
            staff_role: 'supervisor',
            venue_id: 'venue-1',
            zone_id: null,
            caller_role: 'supervisor',
        };
        const result = validateAssignment(input);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/admin/i);
    });

    it('rejects when caller has no assignment permission (driver calling)', () => {
        const input: AssignmentInput = {
            staff_id: 'user-1',
            staff_role: 'driver',
            venue_id: 'venue-1',
            zone_id: 'zone-1',
            caller_role: 'driver',
        };
        const result = validateAssignment(input);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/permission/i);
    });

    // ── Supervisor assignment ────────────────────────────────────────────────

    it('allows admin to assign supervisor to venue (zone_id ignored)', () => {
        const input: AssignmentInput = {
            staff_id: 'user-1',
            staff_role: 'supervisor',
            venue_id: 'venue-1',
            zone_id: 'zone-should-be-ignored',
            caller_role: 'admin',
        };
        const result = validateAssignment(input);
        expect(result.valid).toBe(true);
        expect(result.resolved_venue_id).toBe('venue-1');
        expect(result.resolved_zone_id).toBeNull(); // zone is cleared for supervisors
    });

    it('allows admin to unassign supervisor (null venue)', () => {
        const input: AssignmentInput = {
            staff_id: 'user-1',
            staff_role: 'supervisor',
            venue_id: null,
            zone_id: null,
            caller_role: 'admin',
        };
        const result = validateAssignment(input);
        expect(result.valid).toBe(true);
        expect(result.resolved_venue_id).toBeNull();
        expect(result.resolved_zone_id).toBeNull();
    });

    // ── Driver/Washer assignment ─────────────────────────────────────────────

    it('allows admin to assign driver to a zone', () => {
        const input: AssignmentInput = {
            staff_id: 'user-1',
            staff_role: 'driver',
            venue_id: 'venue-1',
            zone_id: 'zone-1',
            caller_role: 'admin',
        };
        const result = validateAssignment(input);
        expect(result.valid).toBe(true);
        expect(result.resolved_venue_id).toBe('venue-1');
        expect(result.resolved_zone_id).toBe('zone-1');
    });

    it('allows supervisor to assign washer to a zone', () => {
        const input: AssignmentInput = {
            staff_id: 'user-1',
            staff_role: 'washer',
            venue_id: 'venue-1',
            zone_id: 'zone-1',
            caller_role: 'supervisor',
        };
        const result = validateAssignment(input);
        expect(result.valid).toBe(true);
        expect(result.resolved_venue_id).toBe('venue-1');
        expect(result.resolved_zone_id).toBe('zone-1');
    });

    it('rejects driver assignment with zone but no venue', () => {
        const input: AssignmentInput = {
            staff_id: 'user-1',
            staff_role: 'driver',
            venue_id: null,
            zone_id: 'zone-1',
            caller_role: 'admin',
        };
        const result = validateAssignment(input);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/venue/i);
    });

    it('allows unassigning a driver (null venue and zone)', () => {
        const input: AssignmentInput = {
            staff_id: 'user-1',
            staff_role: 'driver',
            venue_id: null,
            zone_id: null,
            caller_role: 'admin',
        };
        const result = validateAssignment(input);
        expect(result.valid).toBe(true);
        expect(result.resolved_venue_id).toBeNull();
        expect(result.resolved_zone_id).toBeNull();
    });

    it('allows assigning driver to venue without zone (partial assignment)', () => {
        const input: AssignmentInput = {
            staff_id: 'user-1',
            staff_role: 'driver',
            venue_id: 'venue-1',
            zone_id: null,
            caller_role: 'supervisor',
        };
        const result = validateAssignment(input);
        expect(result.valid).toBe(true);
        expect(result.resolved_venue_id).toBe('venue-1');
        expect(result.resolved_zone_id).toBeNull();
    });
});
