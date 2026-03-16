-- Migration 006: Staff Duty Assignment by Zone
-- Adds zone_id to users for driver/washer zone-level assignments
-- Creates audit log table for assignment history

-- 1. Add zone_id column to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_zone ON users(zone_id);

-- 2. Audit log for all assignment changes
CREATE TABLE IF NOT EXISTS staff_duty_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id    UUID NOT NULL REFERENCES venues(id),
  zone_id     UUID REFERENCES zones(id) ON DELETE SET NULL,
  assigned_by UUID NOT NULL REFERENCES users(id),
  role        VARCHAR(20) NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_duty_assignments_staff ON staff_duty_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_duty_assignments_venue ON staff_duty_assignments(venue_id);
