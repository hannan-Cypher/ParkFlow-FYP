-- ParkFlow Clean Seed Data
-- Essential staff and venues for production start.

-- 1. Venues
INSERT INTO venues (id, name, address, city, country, total_slots, contact_phone, contact_email, status, created_at, updated_at, gates)
VALUES 
('fa386fdb-366a-4654-9782-df011a8825fb', 'Lucky One Mall', 'Main Rashid Minhas Road', 'Karachi', 'Pakistan', 1000, '021-4444444', 'info@luckyone.pk', 'active', '2026-03-12 23:55:44', '2026-04-09 23:52:49', 3),
('81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', 'Dolmen Mall Clifton', 'Marine Drive', 'Karachi', 'Pakistan', 700, '021-6666666', 'info@dolmenmall.pk', 'active', '2026-03-12 23:55:44', '2026-04-09 23:52:49', 3),
('841079db-b852-4423-899f-78a779870527', 'Packages Mall', 'Walton Road', 'Lahore', 'Pakistan', 650, '042-5555555', 'contact@packagesmall.pk', 'active', '2026-02-25 12:10:10', '2026-04-09 23:52:49', 3),
('11111111-1111-1111-1111-111111111111', 'Centaurus Mall', 'F-8 Markaz', 'Islamabad', 'Pakistan', 500, '051-2222222', 'info@centaurusmall.pk', 'active', '2026-01-02 04:48:24', '2026-04-09 23:52:49', 2)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2. Gates
INSERT INTO gates (id, venue_id, name, display_order)
VALUES 
('7a5e88b3-30b4-475b-b98f-878bb6646c6a', '841079db-b852-4423-899f-78a779870527', 'Packages Main Entry', 1),
('c40e5bc2-930a-4e05-b9f1-5070b87aa500', '11111111-1111-1111-1111-111111111111', 'Centaurus Entry A', 1)
ON CONFLICT (id) DO NOTHING;

-- 3. Zones
INSERT INTO zones (id, venue_id, gate_id, name, total_slots)
VALUES 
('6eb90610-9c04-4382-a66b-3e431bf2debc', '841079db-b852-4423-899f-78a779870527', '7a5e88b3-30b4-475b-b98f-878bb6646c6a', 'Standard Zone', 100),
('c63fd352-553a-4e39-bb9f-3aca364e2ea2', '11111111-1111-1111-1111-111111111111', 'c40e5bc2-930a-4e05-b9f1-5070b87aa500', 'VIP Zone', 50)
ON CONFLICT (id) DO NOTHING;

-- 4. Staff (Using named columns for schema safety)
-- Password for all: password123 ($2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO)

-- Admin
INSERT INTO users (id, email, password, full_name, phone, role, is_active, email_verified, phone_verified)
VALUES ('62f1cbc2-5106-4b80-bd52-07fe6a47589f', 'admin@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Hannan Mohsin', '0314-5144697', 'admin', true, true, true)
ON CONFLICT (email) DO NOTHING;

-- Supervisors
INSERT INTO users (id, email, password, full_name, phone, role, venue_id, is_active)
VALUES 
('39ec01c9-43c1-40b6-bc2d-c86dd98d4efd', 'ali.hassan@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Ali Hassan', '0300-1110001', 'supervisor', '11111111-1111-1111-1111-111111111111', true),
('d360a2ae-da9e-43f4-843f-592172da805e', 'hassan.qureshi@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Hassan Qureshi', '0321-2220001', 'supervisor', '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', true)
ON CONFLICT (email) DO NOTHING;

-- Drivers
INSERT INTO users (id, email, password, full_name, phone, role, venue_id, is_active)
VALUES 
('7bc1df41-bd51-4ccb-aabc-77136ef646b3', 'fahad.siddiqui@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Fahad Siddiqui', '0300-1110006', 'driver', '11111111-1111-1111-1111-111111111111', true),
('1c3b5b05-1325-43d1-be0d-327de1d19ef2', 'asad.nawaz@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Asad Nawaz', '0300-1110010', 'driver', '11111111-1111-1111-1111-111111111111', true)
ON CONFLICT (email) DO NOTHING;

-- Washers
INSERT INTO users (id, email, password, full_name, phone, role, venue_id, is_active)
VALUES 
('abcc490b-5253-47d0-b321-07d9f1da26c0', 'bilal.akhtar@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Bilal Akhtar', '0300-1110003', 'washer', '11111111-1111-1111-1111-111111111111', true),
('05f035dc-9a78-4e05-8dd1-006eeaac1ccf', 'usman.tariq@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Usman Tariq', '0300-1110002', 'washer', '11111111-1111-1111-1111-111111111111', true)
ON CONFLICT (email) DO NOTHING;

-- 5. Parking Slots (Sample)
INSERT INTO parking_slots (id, venue_id, slot_number, floor_level, zone, slot_type, status, zone_id, gate_id)
VALUES 
('89a0d04a-9272-4751-9f39-cda745c3149d', '841079db-b852-4423-899f-78a779870527', 'P1-001', 'Ground', 'Standard', 'standard', 'available', '6eb90610-9c04-4382-a66b-3e431bf2debc', '7a5e88b3-30b4-475b-b98f-878bb6646c6a'),
('ee698e40-a387-40f9-ac46-d616af7c30e5', '11111111-1111-1111-1111-111111111111', 'C1-001', 'B1', 'VIP', 'standard', 'available', 'c63fd352-553a-4e39-bb9f-3aca364e2ea2', 'c40e5bc2-930a-4e05-b9f1-5070b87aa500')
ON CONFLICT (id) DO NOTHING;
