-- Migration 004: Late Staff Arrival Approval
-- Adds late-arrival tracking and admin approval workflow to staff_shifts

ALTER TABLE staff_shifts
  ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_approval VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_approval_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS admin_approval_at TIMESTAMPTZ;

-- Extend the status constraint to include pending_approval and rejected
ALTER TABLE staff_shifts DROP CONSTRAINT IF EXISTS staff_shifts_status_check;
ALTER TABLE staff_shifts ADD CONSTRAINT staff_shifts_status_check
  CHECK (status IN ('active', 'on_break', 'completed', 'pending_approval', 'rejected'));
