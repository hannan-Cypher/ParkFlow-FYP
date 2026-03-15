-- Migration 003: Staff Shift Tracking
-- Adds shift config to venues and creates staff_shifts history table

-- 1. Add shift configuration columns to venues
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS shift_start_time          TIME    DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS shift_end_time            TIME    DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS max_break_minutes         INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS enforce_shift_start_window BOOLEAN DEFAULT TRUE;

-- 2. Create staff_shifts table for full shift history
CREATE TABLE IF NOT EXISTS staff_shifts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id            UUID NOT NULL REFERENCES venues(id),
  shift_start         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shift_end           TIMESTAMPTZ,
  status              VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'on_break', 'completed')),
  break_start         TIMESTAMPTZ,
  total_break_minutes INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff  ON staff_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_status ON staff_shifts(status);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_venue  ON staff_shifts(venue_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_date   ON staff_shifts(shift_start);
