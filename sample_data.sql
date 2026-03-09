-- ============================================
-- PARKFLOW SAMPLE DATA
-- Complete Sample Data for ParkFlow Valet Parking System
-- Password for ALL users: password123
-- ============================================

-- ============================================
-- PHASE 4 SCHEMA EXTENSIONS
-- Run these before inserting sample data
-- ============================================

-- Phase 4: Rating system
ALTER TABLE parking_sessions ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE parking_sessions ADD COLUMN IF NOT EXISTS rating_comment TEXT;

-- ============================================
-- 1. ADMIN USERS (3)
-- ============================================
-- Email Domain: @parkflowpk.com
-- Password: password123

INSERT INTO users (email, password, full_name, phone, role, email_verified, phone_verified, is_active) 
VALUES 
    ('admin@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Ahmed Hassan', '0300-1234567', 'admin', TRUE, TRUE, TRUE),
    ('manager@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Fatima Malik', '0321-9876543', 'admin', TRUE, TRUE, TRUE),
    ('supervisor@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Ali Raza', '0333-5554433', 'admin', TRUE, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 2. VALET STAFF (8)
-- ============================================
-- Email Domain: @parkflowpk.com
-- Password: password123

INSERT INTO users (email, password, full_name, phone, role, email_verified, phone_verified, is_active) 
VALUES 
    ('usman.qadir@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Usman Qadir', '0345-1112233', 'valet_staff', TRUE, TRUE, TRUE),
    ('bilal.khan@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Bilal Khan', '0312-4445566', 'valet_staff', TRUE, TRUE, TRUE),
    ('hamza.shah@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Hamza Shah', '0334-7778899', 'valet_staff', TRUE, TRUE, TRUE),
    ('sara.ahmed@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Sara Ahmed', '0302-2223344', 'valet_staff', TRUE, TRUE, TRUE),
    ('zain.malik@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Zain Malik', '0321-5556677', 'valet_staff', TRUE, TRUE, TRUE),
    ('ayesha.khan@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Ayesha Khan', '0315-8889900', 'valet_staff', TRUE, TRUE, TRUE),
    ('saad.iqbal@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Saad Iqbal', '0300-3334455', 'valet_staff', TRUE, TRUE, TRUE),
    ('hira.ahmed@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Hira Ahmed', '0333-5556677', 'valet_staff', TRUE, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 3. CUSTOMER USERS (20)
-- ============================================
-- Email Domain: @gmail.com ONLY
-- Password: password123

INSERT INTO users (email, password, full_name, phone, role, email_verified, phone_verified, is_active) 
VALUES 
    ('hassan.mahmood@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Hassan Mahmood', '0321-1112233', 'customer', TRUE, TRUE, TRUE),
    ('sana.tariq@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Sana Tariq', '0333-4445566', 'customer', TRUE, TRUE, TRUE),
    ('faisal.butt@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Faisal Butt', '0301-7778899', 'customer', TRUE, FALSE, TRUE),
    ('nimra.sheikh@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Nimra Sheikh', '0345-2223344', 'customer', TRUE, TRUE, TRUE),
    ('imran.ahmad@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Imran Ahmad', '0300-9990011', 'customer', TRUE, TRUE, TRUE),
    ('rabia.siddiqui@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Rabia Siddiqui', '0322-6667788', 'customer', TRUE, TRUE, TRUE),
    ('kamran.haider@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Kamran Haider', '0333-1234567', 'customer', TRUE, FALSE, TRUE),
    ('mahnoor.asif@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Mahnoor Asif', '0315-8889900', 'customer', TRUE, TRUE, TRUE),
    ('danish.farooq@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Danish Farooq', '0304-3334455', 'customer', TRUE, TRUE, TRUE),
    ('maryam.yousaf@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Maryam Yousaf', '0321-5556677', 'customer', TRUE, TRUE, TRUE),
    ('talha.saleem@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Talha Saleem', '0300-7778899', 'customer', TRUE, FALSE, TRUE),
    ('aisha.noor@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Aisha Noor', '0333-2223344', 'customer', TRUE, TRUE, TRUE),
    ('shahzaib.khan@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Shahzaib Khan', '0345-9990011', 'customer', TRUE, TRUE, TRUE),
    ('sidra.ali@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Sidra Ali', '0322-4445566', 'customer', TRUE, TRUE, TRUE),
    ('arsalan.malik@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Arsalan Malik', '0301-6667788', 'customer', TRUE, FALSE, TRUE),
    ('zara.hussain@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Zara Hussain', '0315-1112233', 'customer', TRUE, TRUE, TRUE),
    ('farhan.rasheed@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Farhan Rasheed', '0333-8889900', 'customer', TRUE, TRUE, TRUE),
    ('amna.qadir@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Amna Qadir', '0300-5556677', 'customer', TRUE, TRUE, TRUE),
    ('waqas.bhatti@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Waqas Bhatti', '0321-3334455', 'customer', TRUE, FALSE, TRUE),
    ('sehar.aziz@gmail.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Sehar Aziz', '0345-7778899', 'customer', TRUE, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 4. VENUES (5)
-- ============================================

INSERT INTO venues (name, address, city, capacity, operating_hours, contact_number, email) 
VALUES 
    ('Centaurus Mall', 'F-8 Markaz, Islamabad', 'Islamabad', 500, '10:00 AM - 11:00 PM', '051-2222222', 'info@centaurusmall.pk'),
    ('Emporium Mall', 'Abdul Haque Road, Lahore', 'Lahore', 800, '10:00 AM - 12:00 AM', '042-3333333', 'contact@emporiummall.pk'),
    ('Lucky One Mall', 'Main Rashid Minhas Road, Karachi', 'Karachi', 1000, '11:00 AM - 11:30 PM', '021-4444444', 'info@luckyone.pk'),
    ('Packages Mall', 'Walton Road, Lahore', 'Lahore', 600, '10:00 AM - 11:00 PM', '042-5555555', 'contact@packagesmall.pk'),
    ('Dolmen Mall Clifton', 'Marine Drive, Karachi', 'Karachi', 700, '10:00 AM - 12:00 AM', '021-6666666', 'info@dolmenmall.pk')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 5. VEHICLES (20)
-- ============================================
-- Linked to customer users

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary, notes) 
SELECT 
    'LEA-1234',
    u.id,
    'Honda',
    'Civic',
    'White',
    2022,
    'sedan',
    TRUE,
    'Well maintained, regular customer'
FROM users u WHERE u.email = 'hassan.mahmood@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'LEB-5678',
    u.id,
    'Toyota',
    'Corolla',
    'Silver',
    2021,
    'sedan',
    TRUE
FROM users u WHERE u.email = 'sana.tariq@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'LEC-9012',
    u.id,
    'Suzuki',
    'Cultus',
    'Red',
    2020,
    'hatchback',
    TRUE
FROM users u WHERE u.email = 'faisal.butt@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'RIA-3456',
    u.id,
    'Honda',
    'City',
    'Black',
    2023,
    'sedan',
    TRUE
FROM users u WHERE u.email = 'nimra.sheikh@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'RIB-7890',
    u.id,
    'Toyota',
    'Fortuner',
    'Grey',
    2022,
    'suv',
    TRUE
FROM users u WHERE u.email = 'imran.ahmad@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'KAA-2345',
    u.id,
    'Suzuki',
    'Swift',
    'Blue',
    2021,
    'hatchback',
    TRUE
FROM users u WHERE u.email = 'rabia.siddiqui@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'KAB-6789',
    u.id,
    'Honda',
    'BRV',
    'White',
    2023,
    'suv',
    TRUE
FROM users u WHERE u.email = 'kamran.haider@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'LED-1357',
    u.id,
    'Toyota',
    'Yaris',
    'Silver',
    2022,
    'sedan',
    TRUE
FROM users u WHERE u.email = 'mahnoor.asif@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'LEE-2468',
    u.id,
    'Suzuki',
    'Alto',
    'White',
    2019,
    'hatchback',
    TRUE
FROM users u WHERE u.email = 'danish.farooq@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'RIC-3579',
    u.id,
    'Honda',
    'Accord',
    'Blue',
    2023,
    'sedan',
    TRUE
FROM users u WHERE u.email = 'maryam.yousaf@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'KAC-4680',
    u.id,
    'Toyota',
    'Prado',
    'Black',
    2022,
    'suv',
    TRUE
FROM users u WHERE u.email = 'talha.saleem@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'LEF-5791',
    u.id,
    'Suzuki',
    'WagonR',
    'Red',
    2020,
    'hatchback',
    TRUE
FROM users u WHERE u.email = 'aisha.noor@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'RID-6802',
    u.id,
    'Honda',
    'CR-V',
    'White',
    2023,
    'suv',
    TRUE
FROM users u WHERE u.email = 'shahzaib.khan@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'KAD-7913',
    u.id,
    'Toyota',
    'Vigo',
    'Silver',
    2021,
    'pickup',
    TRUE
FROM users u WHERE u.email = 'sidra.ali@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'LEG-8024',
    u.id,
    'Suzuki',
    'Bolan',
    'White',
    2018,
    'van',
    TRUE
FROM users u WHERE u.email = 'arsalan.malik@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'RIE-9135',
    u.id,
    'Honda',
    'Vezel',
    'Grey',
    2022,
    'suv',
    TRUE
FROM users u WHERE u.email = 'zara.hussain@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'KAE-0246',
    u.id,
    'Toyota',
    'Revo',
    'Black',
    2023,
    'pickup',
    TRUE
FROM users u WHERE u.email = 'farhan.rasheed@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'LEH-1358',
    u.id,
    'Suzuki',
    'Mehran',
    'Red',
    2017,
    'hatchback',
    TRUE
FROM users u WHERE u.email = 'amna.qadir@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'RIF-2469',
    u.id,
    'Honda',
    'Civic Turbo',
    'Blue',
    2024,
    'sedan',
    TRUE
FROM users u WHERE u.email = 'waqas.bhatti@gmail.com';

INSERT INTO vehicles (license_plate, owner_id, make, model, color, year, vehicle_type, is_primary) 
SELECT 
    'KAF-3570',
    u.id,
    'Toyota',
    'Land Cruiser',
    'White',
    2023,
    'suv',
    TRUE
FROM users u WHERE u.email = 'sehar.aziz@gmail.com';

-- ============================================
-- END OF SAMPLE DATA
-- ============================================

-- ============================================
-- 6. ASSIGN STAFF TO VENUES
-- ============================================
-- Distribute 8 staff across the 5 venues
-- Centaurus Mall: 2 staff, Emporium Mall: 2 staff, Lucky One: 2 staff, Packages: 1, Dolmen: 1

UPDATE users SET venue_id = (SELECT id FROM venues WHERE name = 'Centaurus Mall' LIMIT 1) WHERE email = 'usman.qadir@parkflowpk.com';
UPDATE users SET venue_id = (SELECT id FROM venues WHERE name = 'Centaurus Mall' LIMIT 1) WHERE email = 'bilal.khan@parkflowpk.com';
UPDATE users SET venue_id = (SELECT id FROM venues WHERE name = 'Emporium Mall' LIMIT 1) WHERE email = 'hamza.shah@parkflowpk.com';
UPDATE users SET venue_id = (SELECT id FROM venues WHERE name = 'Emporium Mall' LIMIT 1) WHERE email = 'sara.ahmed@parkflowpk.com';
UPDATE users SET venue_id = (SELECT id FROM venues WHERE name = 'Lucky One Mall' LIMIT 1) WHERE email = 'zain.malik@parkflowpk.com';
UPDATE users SET venue_id = (SELECT id FROM venues WHERE name = 'Lucky One Mall' LIMIT 1) WHERE email = 'ayesha.khan@parkflowpk.com';
UPDATE users SET venue_id = (SELECT id FROM venues WHERE name = 'Packages Mall' LIMIT 1) WHERE email = 'saad.iqbal@parkflowpk.com';
UPDATE users SET venue_id = (SELECT id FROM venues WHERE name = 'Dolmen Mall Clifton' LIMIT 1) WHERE email = 'hira.ahmed@parkflowpk.com';

-- ============================================
-- 7. SCHEMA EXTENSIONS (Phase 2 — Damage Assessment)
-- ============================================
ALTER TABLE parking_sessions ADD COLUMN IF NOT EXISTS damage_photos jsonb DEFAULT '[]'::jsonb;
ALTER TABLE parking_sessions ADD COLUMN IF NOT EXISTS damage_notes text;

-- ============================================
-- 8. SCHEMA EXTENSIONS (Phase 3 — Vehicle Retrieval)
-- ============================================
ALTER TABLE parking_sessions ADD COLUMN IF NOT EXISTS retrieval_status text;
ALTER TABLE parking_sessions ADD COLUMN IF NOT EXISTS retrieval_requested_at timestamp with time zone;

-- Summary Report
DO $$
DECLARE
    admin_count INTEGER;
    staff_count INTEGER;
    customer_count INTEGER;
    venue_count INTEGER;
    vehicle_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'admin';
    SELECT COUNT(*) INTO staff_count FROM users WHERE role = 'valet_staff';
    SELECT COUNT(*) INTO customer_count FROM users WHERE role = 'customer';
    SELECT COUNT(*) INTO venue_count FROM venues;
    SELECT COUNT(*) INTO vehicle_count FROM vehicles;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'SAMPLE DATA LOADED SUCCESSFULLY';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Admins: %', admin_count;
    RAISE NOTICE 'Valet Staff: %', staff_count;
    RAISE NOTICE 'Customers: %', customer_count;
    RAISE NOTICE 'Venues: %', venue_count;
    RAISE NOTICE 'Vehicles: %', vehicle_count;
    RAISE NOTICE '============================================';
    RAISE NOTICE 'PASSWORD FOR ALL USERS: password123';
    RAISE NOTICE '============================================';
END $$;
