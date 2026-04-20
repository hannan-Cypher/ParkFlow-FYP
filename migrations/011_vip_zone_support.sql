-- Migration 011: VIP Zone Support and Separate Pricing
-- Adds VIP toggles to zones and separate pricing/multipliers to venues.
-- Adds session-level class tracking.

-- 1. Add is_vip to zones
ALTER TABLE zones 
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;

-- 2. Add VIP pricing to venues
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS vip_base_rate_per_hour NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vip_high_occupancy_multiplier NUMERIC DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS vip_critical_occupancy_multiplier NUMERIC DEFAULT 2.0;

-- 3. Add requested_class to parking_sessions
ALTER TABLE parking_sessions
  ADD COLUMN IF NOT EXISTS requested_class VARCHAR(20) DEFAULT 'standard' CHECK (requested_class IN ('standard', 'vip'));

-- 4. Set initial VIP base rates to something sensible (e.g., 2x dynamic base rate)
-- This is a one-time setup for existing venues if needed.
UPDATE venues SET vip_base_rate_per_hour = base_rate_per_hour * 2 WHERE vip_base_rate_per_hour = 0;
