import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

// ── Helpers ──────────────────────────────────────────────────────────────────────

/** Plate with a UUID suffix so parallel runs never collide */
function uniquePlate(): string {
    return `TST-${randomUUID().slice(0, 6).toUpperCase()}`;
}

/** Safely unwrap a JSON response that may be wrapped under a key */
function unwrap(body: any): any {
    return body?.session ?? body;
}

// ── Test Suite ────────────────────────────────────────────────────────────────────

test.describe('Zone-Pinned Slot Allocation', () => {

    let venueId: string;
    let staffWithZone: { id: string; zone_id: string };
    let staffNoZone: { id: string } | null = null;

    test.beforeAll('Discover test data from public endpoints', async ({ request }) => {
        // GET /api/locations is public — use as connectivity check + venue discovery
        const venuesRes = await request.get(`${BASE}/api/locations`);
        expect(venuesRes.ok()).toBeTruthy();
        const venuesBody = await venuesRes.json();
        const venues: any[] = Array.isArray(venuesBody)
            ? venuesBody
            : venuesBody?.data ?? venuesBody?.venues ?? [];
        expect(venues.length).toBeGreaterThan(0);
        venueId = venues[0].id;

        // GET /api/staff is public — find staff with and without zone assignment
        const staffRes = await request.get(`${BASE}/api/staff`);
        expect(staffRes.ok()).toBeTruthy();
        const staffBody = await staffRes.json();
        const allStaff: any[] = Array.isArray(staffBody)
            ? staffBody
            : staffBody?.staff ?? staffBody?.data ?? [];
        expect(allStaff.length).toBeGreaterThan(0);

        const withZoneEntry = allStaff.find((s: any) => s.zone_id);
        const noZoneEntry = allStaff.find((s: any) => !s.zone_id);

        if (withZoneEntry) {
            staffWithZone = { id: withZoneEntry.id, zone_id: withZoneEntry.zone_id };
        }
        if (noZoneEntry) {
            staffNoZone = { id: noZoneEntry.id };
        }

        test.skip(!withZoneEntry, 'No staff with zone_id found — cannot test zone pinning');
    });

    // ── Happy path: zone pinning ──────────────────────────────────────────

    test('TC1: Staff with zone → slot allocated in same zone', async ({ request }) => {
        test.skip(!staffWithZone, 'Prerequisite: staff-with-zone not found');

        const plate = uniquePlate();
        const res = await request.post(`${BASE}/api/sessions/checkin`, {
            data: {
                license_plate: plate,
                venue_id: venueId,
                staff_id: staffWithZone.id,
                vehicle_type: 'sedan',
                make: 'Toyota',
                model: 'Corolla',
                color: 'White',
            },
        });

        expect(res.ok()).toBeTruthy();
        const session = unwrap(await res.json());

        expect(session.slot.zone_id).toBe(staffWithZone.zone_id);
        expect(session.valet_staff_id).toBe(staffWithZone.id);
    });

    // ── Fallback: no staff_id → gate-based ────────────────────────────────

    test('TC2: No staff_id → slot + auto-assigned staff (gate-based fallback)', async ({ request }) => {
        const plate = uniquePlate();
        const res = await request.post(`${BASE}/api/sessions/checkin`, {
            data: {
                license_plate: plate,
                venue_id: venueId,
                vehicle_type: 'sedan',
                make: 'Honda',
                model: 'Civic',
                color: 'Black',
            },
        });

        expect(res.ok()).toBeTruthy();
        const session = unwrap(await res.json());

        expect(session.slot).toBeDefined();
        expect(session.slot.slot_number).toBeDefined();
        // Without staff_id, the system auto-assigns someone
        expect(session.valet_staff_id).toBeDefined();
    });

    // ── Fallback: staff without zone → legacy gate-based ──────────────────

    test('TC3: Staff without zone_id → slot allocated, staff preserved', async ({ request }) => {
        test.skip(!staffNoZone, 'Prerequisite: staff-without-zone not found');

        const plate = uniquePlate();
        const res = await request.post(`${BASE}/api/sessions/checkin`, {
            data: {
                license_plate: plate,
                venue_id: venueId,
                staff_id: staffNoZone.id,
                vehicle_type: 'suv',
                make: 'Toyota',
                model: 'Fortuner',
                color: 'Silver',
            },
        });

        expect(res.ok()).toBeTruthy();
        const session = unwrap(await res.json());

        expect(session.slot).toBeDefined();
        // The requested staff is still assigned (assignStaff priority 1)
        expect(session.valet_staff_id).toBe(staffNoZone.id);
    });

    // ── Error paths ────────────────────────────────────────────────────────

    test('TC4: Duplicate active session → 409', async ({ request }) => {
        const plate = uniquePlate();

        const res1 = await request.post(`${BASE}/api/sessions/checkin`, {
            data: {
                license_plate: plate,
                venue_id: venueId,
                vehicle_type: 'sedan',
                make: 'Test',
                model: 'Car',
                color: 'Blue',
            },
        });
        expect(res1.ok()).toBeTruthy();

        const res2 = await request.post(`${BASE}/api/sessions/checkin`, {
            data: {
                license_plate: plate,
                venue_id: venueId,
                vehicle_type: 'sedan',
                make: 'Test',
                model: 'Car',
                color: 'Blue',
            },
        });
        expect(res2.status()).toBe(409);
    });

    test('TC5: Missing required fields → 400', async ({ request }) => {
        const res = await request.post(`${BASE}/api/sessions/checkin`, {
            data: { license_plate: uniquePlate() }, // missing venue_id
        });
        expect(res.status()).toBe(400);
    });

    test('TC6: Invalid venue_id → 404', async ({ request }) => {
        const res = await request.post(`${BASE}/api/sessions/checkin`, {
            data: {
                license_plate: uniquePlate(),
                venue_id: '00000000-0000-0000-0000-000000000000',
            },
        });
        expect(res.status()).toBe(404);
    });
});
