-- Migration 005: Expanded Staff Roles
-- Adds supervisor, driver, washer roles. Migrates valet_staff → driver.
-- Adds wash-specific columns to service_requests.

-- ── 1. Expand role constraint ───────────────────────────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'driver', 'washer', 'supervisor', 'admin'));

-- ── 2. Migrate existing valet_staff → driver ────────────────────────────────
UPDATE users SET role = 'driver', updated_at = NOW() WHERE role = 'valet_staff';

-- ── 3. Add wash-specific columns to service_requests ────────────────────────
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS wash_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS before_photos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS after_photos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES parking_slots(id) ON DELETE SET NULL;

-- ── 4. Add role column to staff_invitations (if table exists) ───────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_invitations') THEN
    ALTER TABLE staff_invitations ADD COLUMN IF NOT EXISTS staff_role VARCHAR(20) DEFAULT 'driver';
  END IF;
END $$;

-- ── 5. Index for fast washer task lookups ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_service_requests_assigned_status
  ON service_requests(assigned_to, service_status);
CREATE INDEX IF NOT EXISTS idx_service_requests_venue_type
  ON service_requests(venue_id, service_type);
