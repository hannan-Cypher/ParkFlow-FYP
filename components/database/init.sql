-- AI Valet Parking Management System
-- PostgreSQL Database Initialization Script

-- Drop tables if they exist (be careful in production!)
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS parking_history CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sessions table for authentication
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create vehicles table
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    color VARCHAR(50),
    year INTEGER,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vehicle_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create parking_history table
CREATE TABLE parking_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    license_plate VARCHAR(20) NOT NULL,
    slot_number VARCHAR(20),
    entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exit_time TIMESTAMP,
    duration_minutes INTEGER,
    amount_paid DECIMAL(10, 2),
    payment_status VARCHAR(20) DEFAULT 'pending',
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    CONSTRAINT fk_parking_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_parking_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- Create indexes for better query performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_parking_user_id ON parking_history(user_id);
CREATE INDEX idx_parking_vehicle_id ON parking_history(vehicle_id);
CREATE INDEX idx_parking_status ON parking_history(status);
CREATE INDEX idx_parking_entry_time ON parking_history(entry_time);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
-- WARNING: These passwords are hashed versions of "Password123"
-- In production, users should set their own passwords through the signup process

-- Sample user (password: Password123)
INSERT INTO users (email, password, full_name, phone, email_verified) VALUES
('john.doe@example.com', '$2a$10$rQ8xYvI3X0KVH7qTvYkF0.8nZoX1gV3wL0mKz0WqYqLBRJ0vKx4Km', 'John Doe', '+1-555-0101', TRUE),
('jane.smith@example.com', '$2a$10$rQ8xYvI3X0KVH7qTvYkF0.8nZoX1gV3wL0mKz0WqYqLBRJ0vKx4Km', 'Jane Smith', '+1-555-0102', TRUE);

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Display table information
SELECT 
    'Database initialized successfully!' AS message,
    COUNT(*) AS total_users 
FROM users;

-- Display all tables
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
