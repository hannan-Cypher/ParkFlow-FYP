-- ============================================
-- MIGRATION: Gate → Zone → Slot Hierarchy
-- Run this on existing databases to add the
-- gates and zones tables and update parking_slots
-- ============================================

-- 1. Create gates table
CREATE TABLE IF NOT EXISTS gates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(venue_id, name)
);

-- 2. Create zones table
CREATE TABLE IF NOT EXISTS zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gate_id UUID REFERENCES gates(id) ON DELETE CASCADE NOT NULL,
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    total_slots INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(venue_id, name)
);

-- 3. Add zone_id and gate_id columns to parking_slots
ALTER TABLE parking_slots ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id) ON DELETE CASCADE;
ALTER TABLE parking_slots ADD COLUMN IF NOT EXISTS gate_id UUID REFERENCES gates(id) ON DELETE CASCADE;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_gates_venue ON gates(venue_id);
CREATE INDEX IF NOT EXISTS idx_zones_gate ON zones(gate_id);
CREATE INDEX IF NOT EXISTS idx_zones_venue ON zones(venue_id);
CREATE INDEX IF NOT EXISTS idx_parking_slots_zone_id ON parking_slots(zone_id);
CREATE INDEX IF NOT EXISTS idx_parking_slots_gate_id ON parking_slots(gate_id);

-- 5. Triggers for updated_at
DROP TRIGGER IF EXISTS update_gates_updated_at ON gates;
CREATE TRIGGER update_gates_updated_at BEFORE UPDATE ON gates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_zones_updated_at ON zones;
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE — Run this ONCE on your existing database
-- ============================================
