-- 1. Backfill gate_id for parking_slots from their parent zone
-- This is necessary because some slots might have been created before gate_id was a column in this table, 
-- or they weren't linked during a manual zone update.
UPDATE parking_slots sl
SET gate_id = z.gate_id
FROM zones z
WHERE sl.zone_id = z.id 
  AND sl.gate_id IS NULL;

-- 2. Backfill gate_id for active parking_sessions from their assigned slots
-- If a session has gate_id as NULL, we infer it from the slot it's occupying.
UPDATE parking_sessions ps
SET gate_id = sl.gate_id
FROM parking_slots sl
WHERE ps.slot_id = sl.id
  AND ps.gate_id IS NULL;

-- 3. Verify counts (Information only)
-- SELECT count(*) FROM parking_sessions WHERE gate_id IS NULL AND status = 'active';
