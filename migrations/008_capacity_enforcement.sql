-- ============================================================
-- Migration 008: Capacity enforcement constraints
-- Prevents double-booking of parking slots at the DB level.
-- ============================================================

-- 1. Partial unique index: no two ACTIVE sessions may share the same slot.
--    This is a last-resort guard that complements the application-level
--    slot allocation logic (parking_slots.status = 'available' check).
CREATE UNIQUE INDEX IF NOT EXISTS uq_parking_sessions_active_slot
    ON parking_sessions (slot_id)
    WHERE status = 'active' AND slot_id IS NOT NULL;

-- 2. Add a CHECK constraint ensuring slot status values are canonical.
--    Prevents accidental typos (e.g. 'Available', 'OCCUPIED') from polluting
--    the status field which the checkin route relies on.
ALTER TABLE parking_slots
    DROP CONSTRAINT IF EXISTS chk_parking_slots_status;

ALTER TABLE parking_slots
    ADD CONSTRAINT chk_parking_slots_status
    CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance'));
