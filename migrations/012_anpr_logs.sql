CREATE TABLE IF NOT EXISTS anpr_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR(50) NOT NULL,
    confidence NUMERIC(5,2),
    ocr_method VARCHAR(50),
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
