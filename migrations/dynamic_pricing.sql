-- Dynamic Pricing Migration
-- Run once against the valet_parking database

-- Add pricing config columns to venues table
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS base_rate_per_hour        DECIMAL(10,2) DEFAULT 150.00,
  ADD COLUMN IF NOT EXISTS high_occupancy_threshold  INTEGER       DEFAULT 80,
  ADD COLUMN IF NOT EXISTS high_occupancy_multiplier DECIMAL(4,2)  DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS critical_occupancy_threshold  INTEGER   DEFAULT 95,
  ADD COLUMN IF NOT EXISTS critical_occupancy_multiplier DECIMAL(4,2) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS peak_hours                JSONB         DEFAULT '[{"start":"08:00","end":"10:00","label":"Morning Rush"},{"start":"17:00","end":"20:00","label":"Evening Rush"}]',
  ADD COLUMN IF NOT EXISTS peak_hour_surcharge       DECIMAL(10,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS max_rate_per_hour         DECIMAL(10,2) DEFAULT 500.00,
  ADD COLUMN IF NOT EXISTS min_rate_per_hour         DECIMAL(10,2) DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS is_dynamic_enabled        BOOLEAN       DEFAULT true;

-- Add pricing snapshot column to parking_sessions table
ALTER TABLE parking_sessions
  ADD COLUMN IF NOT EXISTS pricing_metadata JSONB;
