-- 1. Add gate_id to parking_sessions (nullable for backward compat)
ALTER TABLE parking_sessions
  ADD COLUMN IF NOT EXISTS gate_id uuid REFERENCES gates(id) ON DELETE SET NULL;

-- 2. Add gate_id to anpr_logs (nullable for backward compat)
ALTER TABLE anpr_logs
  ADD COLUMN IF NOT EXISTS gate_id uuid REFERENCES gates(id) ON DELETE SET NULL;

-- 3. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_parking_sessions_gate_id ON parking_sessions(gate_id);
CREATE INDEX IF NOT EXISTS idx_anpr_logs_gate_id ON anpr_logs(gate_id);
