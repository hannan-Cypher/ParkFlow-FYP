-- ============================================================
-- ParkFlow — Database Initialization Script
-- Single source of truth. Run once on a fresh database.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── venues ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
    id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                          VARCHAR(255) NOT NULL,
    address                       TEXT NOT NULL,
    city                          VARCHAR(100) NOT NULL,
    country                       VARCHAR(100) NOT NULL DEFAULT 'Pakistan',
    total_slots                   INTEGER NOT NULL DEFAULT 0,
    gates                         INTEGER NOT NULL DEFAULT 1,
    contact_phone                 VARCHAR(20),
    contact_email                 VARCHAR(255),
    status                        VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    -- Dynamic pricing
    base_rate_per_hour            DECIMAL(10,2) DEFAULT 150.00,
    high_occupancy_threshold      INTEGER       DEFAULT 80,
    high_occupancy_multiplier     DECIMAL(4,2)  DEFAULT 1.5,
    critical_occupancy_threshold  INTEGER       DEFAULT 95,
    critical_occupancy_multiplier DECIMAL(4,2)  DEFAULT 2.0,
    peak_hours                    JSONB         DEFAULT '[{"start":"08:00","end":"10:00","label":"Morning Rush"},{"start":"17:00","end":"20:00","label":"Evening Rush"}]',
    peak_hour_surcharge           DECIMAL(10,2) DEFAULT 50.00,
    max_rate_per_hour             DECIMAL(10,2) DEFAULT 500.00,
    min_rate_per_hour             DECIMAL(10,2) DEFAULT 100.00,
    is_dynamic_enabled            BOOLEAN       DEFAULT true,
    created_at                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── gates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gates (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id      UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    name          VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(venue_id, name)
);

-- ── zones ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zones (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gate_id     UUID REFERENCES gates(id) ON DELETE CASCADE NOT NULL,
    venue_id    UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    total_slots INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(venue_id, name)
);

-- ── users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email             VARCHAR(255) UNIQUE NOT NULL,
    password          VARCHAR(255) NOT NULL,
    full_name         VARCHAR(255) NOT NULL,
    phone             VARCHAR(20) NOT NULL,
    role              VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'driver', 'washer', 'supervisor', 'admin')),
    venue_id          UUID REFERENCES venues(id) ON DELETE SET NULL,
    zone_id           UUID REFERENCES zones(id) ON DELETE SET NULL,
    profile_image_url TEXT,
    is_active         BOOLEAN DEFAULT TRUE,
    email_verified    BOOLEAN DEFAULT FALSE,
    phone_verified    BOOLEAN DEFAULT FALSE,
    last_login        TIMESTAMP,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── vehicles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_plate   VARCHAR(50) NOT NULL UNIQUE,
    owner_id        UUID REFERENCES users(id) ON DELETE CASCADE,
    make            VARCHAR(100),
    model           VARCHAR(100),
    color           VARCHAR(50),
    year            INTEGER,
    vehicle_type    VARCHAR(50) DEFAULT 'car',
    is_primary      BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── parking_slots ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parking_slots (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id    UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    slot_number VARCHAR(50) NOT NULL,
    floor_level VARCHAR(20),
    zone        VARCHAR(50),
    zone_id     UUID REFERENCES zones(id) ON DELETE CASCADE,
    gate_id     UUID REFERENCES gates(id) ON DELETE CASCADE,
    slot_type   VARCHAR(50) DEFAULT 'standard',
    status      VARCHAR(20) DEFAULT 'available',
    camera_id   VARCHAR(100),
    coordinates JSONB,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(venue_id, slot_number)
);

-- ── parking_sessions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parking_sessions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id              UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
    customer_id             UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    venue_id                UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    slot_id                 UUID REFERENCES parking_slots(id) ON DELETE SET NULL,
    valet_staff_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    entry_time              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exit_time               TIMESTAMP,
    entry_image_url         TEXT,
    exit_image_url          TEXT,
    entry_plate_confidence  DECIMAL(5,2),
    exit_plate_confidence   DECIMAL(5,2),
    status                  VARCHAR(20) DEFAULT 'active',
    qr_code                 TEXT UNIQUE,
    sms_code                VARCHAR(10),
    rate_per_hour           DECIMAL(10,2) DEFAULT 100.00,
    total_hours             DECIMAL(10,2),
    total_amount            DECIMAL(10,2),
    payment_status          VARCHAR(20) DEFAULT 'pending',
    customer_notes          TEXT,
    staff_notes             TEXT,
    damage_photos           JSONB DEFAULT '[]',
    damage_notes            TEXT,
    retrieval_status        TEXT,
    retrieval_requested_at  TIMESTAMP WITH TIME ZONE,
    rating                  INTEGER CHECK (rating BETWEEN 1 AND 5),
    rating_comment          TEXT,
    pricing_metadata        JSONB,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id               UUID REFERENCES parking_sessions(id) ON DELETE CASCADE NOT NULL,
    customer_id              UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    amount                   DECIMAL(10,2) NOT NULL,
    payment_method           VARCHAR(50),
    payment_status           VARCHAR(20) DEFAULT 'pending',
    transaction_reference    VARCHAR(255),
    payment_gateway_response JSONB,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── service_requests ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_requests (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id     UUID REFERENCES parking_sessions(id) ON DELETE CASCADE NOT NULL,
    customer_id    UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    service_type   VARCHAR(50) NOT NULL,
    service_status VARCHAR(20) DEFAULT 'pending',
    assigned_to    UUID REFERENCES users(id) ON DELETE SET NULL,
    service_cost   DECIMAL(10,2),
    notes          TEXT,
    started_at     TIMESTAMP,
    completed_at   TIMESTAMP,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── security_logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_logs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id         UUID REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    event_type       VARCHAR(50) NOT NULL,
    license_plate    VARCHAR(50),
    image_url        TEXT,
    confidence_score DECIMAL(5,2),
    camera_id        VARCHAR(100),
    description      TEXT,
    severity         VARCHAR(20) DEFAULT 'info',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title              VARCHAR(255) NOT NULL,
    message            TEXT NOT NULL,
    type               VARCHAR(50),
    read               BOOLEAN DEFAULT FALSE,
    related_session_id UUID REFERENCES parking_sessions(id) ON DELETE CASCADE,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── sessions (auth tokens) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token      TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_token               ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user                ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email                  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone                  ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role                   ON users(role);
CREATE INDEX IF NOT EXISTS idx_vehicles_license_plate       ON vehicles(license_plate);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner               ON vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_gates_venue                  ON gates(venue_id);
CREATE INDEX IF NOT EXISTS idx_zones_gate                   ON zones(gate_id);
CREATE INDEX IF NOT EXISTS idx_zones_venue                  ON zones(venue_id);
CREATE INDEX IF NOT EXISTS idx_parking_slots_venue          ON parking_slots(venue_id);
CREATE INDEX IF NOT EXISTS idx_parking_slots_status         ON parking_slots(status);
CREATE INDEX IF NOT EXISTS idx_parking_slots_zone_id        ON parking_slots(zone_id);
CREATE INDEX IF NOT EXISTS idx_parking_slots_gate_id        ON parking_slots(gate_id);
CREATE INDEX IF NOT EXISTS idx_parking_sessions_customer    ON parking_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_parking_sessions_vehicle     ON parking_sessions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_parking_sessions_status      ON parking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_parking_sessions_venue       ON parking_sessions(venue_id);

-- ── updated_at trigger function ──────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ── Triggers ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_venues_updated_at          ON venues;
CREATE TRIGGER update_venues_updated_at          BEFORE UPDATE ON venues          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at           ON users;
CREATE TRIGGER update_users_updated_at           BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vehicles_updated_at        ON vehicles;
CREATE TRIGGER update_vehicles_updated_at        BEFORE UPDATE ON vehicles        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gates_updated_at           ON gates;
CREATE TRIGGER update_gates_updated_at           BEFORE UPDATE ON gates           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_zones_updated_at           ON zones;
CREATE TRIGGER update_zones_updated_at           BEFORE UPDATE ON zones           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_parking_slots_updated_at   ON parking_slots;
CREATE TRIGGER update_parking_slots_updated_at   BEFORE UPDATE ON parking_slots   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_parking_sessions_updated_at ON parking_sessions;
CREATE TRIGGER update_parking_sessions_updated_at BEFORE UPDATE ON parking_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Seed: default admin user (password: password123) ─────────
-- Hash: bcrypt of "password123"
INSERT INTO users (email, password, full_name, phone, role, email_verified, phone_verified, is_active)
VALUES (
    'admin@parkflowpk.com',
    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO',
    'Ahmed Hassan',
    '0300-1234567',
    'admin',
    TRUE, TRUE, TRUE
) ON CONFLICT (email) DO NOTHING;
