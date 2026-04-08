-- ============================================================
-- PARKFLOW STAFF SEED DATA
-- Populates ~90 staff across 6 venues
-- Per venue: 1 supervisor, 3 washers, 11 drivers
-- Password for ALL staff: password123
-- Hash: $2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO
-- Valid roles: driver, washer, supervisor (NOT valet_staff)
-- ============================================================

-- Venue IDs:
-- Centaurus Mall      (Islamabad)  : 11111111-1111-1111-1111-111111111111
-- Dolmen Mall Clifton (Karachi)    : 81a5f18c-fb2a-4a13-ba6f-205de99a0dd9
-- Emporium Mall       (Lahore)     : c40e5bc2-930a-4e05-b9f1-5070b87aa500
-- Lucky One Mall      (Karachi)    : fa386fdb-366a-4654-9782-df011a8825fb
-- Packages Mall       (Lahore)     : 841079db-b852-4423-899f-78a779870527
-- Rafay Mall          (Rawalpindi) : 7260e49e-df79-4332-bb74-528566dbf0e0

-- ============================================================
-- CENTAURUS MALL - ISLAMABAD (15 staff: 1 supervisor, 3 washers, 11 drivers)
-- ============================================================
INSERT INTO users (email, password, full_name, phone, role, venue_id, email_verified, phone_verified, is_active)
VALUES
  ('ali.hassan@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Ali Hassan',        '0300-1110001', 'supervisor', '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('usman.tariq@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Usman Tariq',       '0300-1110002', 'washer',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('bilal.akhtar@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Bilal Akhtar',      '0300-1110003', 'washer',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('hamza.khan@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Hamza Khan',        '0300-1110004', 'washer',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('zaid.mehmood@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Zaid Mehmood',      '0300-1110005', 'driver',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('fahad.siddiqui@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Fahad Siddiqui',    '0300-1110006', 'driver',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('saad.riaz@parkflowpk.com',      '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Saad Riaz',         '0300-1110007', 'driver',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('kamran.javed@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Kamran Javed',      '0300-1110008', 'driver',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('waqas.butt@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Waqas Butt',        '0300-1110009', 'driver',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('asad.nawaz@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Asad Nawaz',        '0300-1110010', 'driver',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('shahzad.ali@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Shahzad Ali',       '0300-1110011', 'driver',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('imran.raza@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Imran Raza',        '0300-1110012', 'driver',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('danish.yousaf@parkflowpk.com',  '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Danish Yousaf',     '0300-1110013', 'driver',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('junaid.gill@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Junaid Gill',       '0300-1110014', 'driver',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE),
  ('noman.sheikh@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Noman Sheikh',      '0300-1110015', 'driver',     '11111111-1111-1111-1111-111111111111', TRUE, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- DOLMEN MALL CLIFTON - KARACHI (15 staff: 1 supervisor, 3 washers, 11 drivers)
-- ============================================================
INSERT INTO users (email, password, full_name, phone, role, venue_id, email_verified, phone_verified, is_active)
VALUES
  ('hassan.qureshi@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Hassan Qureshi',    '0321-2220001', 'supervisor', '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('ahsan.baig@parkflowpk.com',       '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Ahsan Baig',        '0321-2220002', 'washer',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('faisal.mirza@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Faisal Mirza',      '0321-2220003', 'washer',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('omer.farooq@parkflowpk.com',      '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Omer Farooq',       '0321-2220004', 'washer',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('talha.ansari@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Talha Ansari',      '0321-2220005', 'driver',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('zubair.ahmed@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Zubair Ahmed',      '0321-2220006', 'driver',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('rehan.malik@parkflowpk.com',      '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Rehan Malik',       '0321-2220007', 'driver',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('adnan.sultan@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Adnan Sultan',      '0321-2220008', 'driver',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('tariq.hussain@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Tariq Hussain',     '0321-2220009', 'driver',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('salman.ghazi@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Salman Ghazi',      '0321-2220010', 'driver',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('irfan.shah@parkflowpk.com',       '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Irfan Shah',        '0321-2220011', 'driver',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('naeem.chaudhry@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Naeem Chaudhry',    '0321-2220012', 'driver',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('mansoor.ali@parkflowpk.com',      '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Mansoor Ali',       '0321-2220013', 'driver',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('yasir.khan@parkflowpk.com',       '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Yasir Khan',        '0321-2220014', 'driver',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE),
  ('rizwan.iqbal@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Rizwan Iqbal',      '0321-2220015', 'driver',     '81a5f18c-fb2a-4a13-ba6f-205de99a0dd9', TRUE, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- EMPORIUM MALL - LAHORE (15 staff: 1 supervisor, 3 washers, 11 drivers)
-- ============================================================
INSERT INTO users (email, password, full_name, phone, role, venue_id, email_verified, phone_verified, is_active)
VALUES
  ('awais.fiaz@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Awais Fiaz',        '0333-3330001', 'supervisor', 'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('shoaib.malik@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Shoaib Malik',      '0333-3330002', 'washer',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('nabeel.ahmed@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Nabeel Ahmed',      '0333-3330003', 'washer',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('waseem.rana@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Waseem Rana',       '0333-3330004', 'washer',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('khalid.mehmood@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Khalid Mehmood',    '0333-3330005', 'driver',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('naveed.aslam@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Naveed Aslam',      '0333-3330006', 'driver',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('shehzad.noor@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Shehzad Noor',      '0333-3330007', 'driver',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('atif.bajwa@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Atif Bajwa',        '0333-3330008', 'driver',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('tahir.javid@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Tahir Javid',       '0333-3330009', 'driver',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('zeeshan.haider@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Zeeshan Haider',    '0333-3330010', 'driver',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('kashif.rauf@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Kashif Rauf',       '0333-3330011', 'driver',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('gulfam.hussain@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Gulfam Hussain',    '0333-3330012', 'driver',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('amjad.rafique@parkflowpk.com',  '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Amjad Rafique',     '0333-3330013', 'driver',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('farrukh.zaidi@parkflowpk.com',  '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Farrukh Zaidi',     '0333-3330014', 'driver',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE),
  ('raees.chishti@parkflowpk.com',  '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Raees Chishti',     '0333-3330015', 'driver',     'c40e5bc2-930a-4e05-b9f1-5070b87aa500', TRUE, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- LUCKY ONE MALL - KARACHI (15 staff: 1 supervisor, 3 washers, 11 drivers)
-- ============================================================
INSERT INTO users (email, password, full_name, phone, role, venue_id, email_verified, phone_verified, is_active)
VALUES
  ('junaid.sattar@parkflowpk.com',  '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Junaid Sattar',     '0312-4440001', 'supervisor', 'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('anas.shaikh@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Anas Shaikh',       '0312-4440002', 'washer',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('burhan.baloch@parkflowpk.com',  '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Burhan Baloch',     '0312-4440003', 'washer',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('daniyal.saeed@parkflowpk.com',  '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Daniyal Saeed',     '0312-4440004', 'washer',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('ehsan.umar@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Ehsan Umar',        '0312-4440005', 'driver',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('faraz.niazi@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Faraz Niazi',       '0312-4440006', 'driver',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('ghulam.mustafa@parkflowpk.com', '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Ghulam Mustafa',    '0312-4440007', 'driver',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('haris.lodhi@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Haris Lodhi',       '0312-4440008', 'driver',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('ijaz.memon@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Ijaz Memon',        '0312-4440009', 'driver',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('jawad.patel@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Jawad Patel',       '0312-4440010', 'driver',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('kaleem.uddin@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Kaleem Uddin',      '0312-4440011', 'driver',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('luqman.ali@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Luqman Ali',        '0312-4440012', 'driver',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('mohsin.qayyum@parkflowpk.com',  '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Mohsin Qayyum',     '0312-4440013', 'driver',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('nasir.waheed@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Nasir Waheed',      '0312-4440014', 'driver',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE),
  ('obaid.rehman@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Obaid Rehman',      '0312-4440015', 'driver',     'fa386fdb-366a-4654-9782-df011a8825fb', TRUE, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- PACKAGES MALL - LAHORE (15 staff: 1 supervisor, 3 washers, 11 drivers)
-- ============================================================
INSERT INTO users (email, password, full_name, phone, role, venue_id, email_verified, phone_verified, is_active)
VALUES
  ('pervaiz.alam@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Pervaiz Alam',      '0345-5550001', 'supervisor', '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('qasim.bashir@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Qasim Bashir',      '0345-5550002', 'washer',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('rashid.sultan@parkflowpk.com',  '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Rashid Sultan',     '0345-5550003', 'washer',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('siraj.uddin@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Siraj Uddin',       '0345-5550004', 'washer',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('tanveer.butt@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Tanveer Butt',      '0345-5550005', 'driver',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('umair.mirza@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Umair Mirza',       '0345-5550006', 'driver',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('viqar.ahmed@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Viqar Ahmed',       '0345-5550007', 'driver',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('wajid.hassan@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Wajid Hassan',      '0345-5550008', 'driver',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('xaib.raza@parkflowpk.com',      '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Xaib Raza',         '0345-5550009', 'driver',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('yaseen.gul@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Yaseen Gul',        '0345-5550010', 'driver',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('zafarullah.khan@parkflowpk.com','$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Zafarullah Khan',   '0345-5550011', 'driver',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('arif.chohan@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Arif Chohan',       '0345-5550012', 'driver',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('babar.cheema@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Babar Cheema',      '0345-5550013', 'driver',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('changez.maqsood@parkflowpk.com','$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Changez Maqsood',   '0345-5550014', 'driver',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE),
  ('dilnawaz.afridi@parkflowpk.com','$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Dilnawaz Afridi',   '0345-5550015', 'driver',     '841079db-b852-4423-899f-78a779870527', TRUE, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- RAFAY MALL - RAWALPINDI (15 staff: 1 supervisor, 3 washers, 11 drivers)
-- ============================================================
INSERT INTO users (email, password, full_name, phone, role, venue_id, email_verified, phone_verified, is_active)
VALUES
  ('ehtisham.bhatti@parkflowpk.com',   '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Ehtisham Bhatti',   '0302-6660001', 'supervisor', '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('farhan.gondal@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Farhan Gondal',     '0302-6660002', 'washer',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('ghazanfar.awan@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Ghazanfar Awan',    '0302-6660003', 'washer',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('hafiz.rehman@parkflowpk.com',      '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Hafiz Rehman',      '0302-6660004', 'washer',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('inam.kazmi@parkflowpk.com',        '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Inam Kazmi',        '0302-6660005', 'driver',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('javed.abbasi@parkflowpk.com',      '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Javed Abbasi',      '0302-6660006', 'driver',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('kashif.nisar@parkflowpk.com',      '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Kashif Nisar',      '0302-6660007', 'driver',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('liaquat.chaudhry@parkflowpk.com',  '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Liaquat Chaudhry',  '0302-6660008', 'driver',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('munawwar.sajid@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Munawwar Sajid',    '0302-6660009', 'driver',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('nausherwan.taj@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Nausherwan Taj',    '0302-6660010', 'driver',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('owais.durrani@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Owais Durrani',     '0302-6660011', 'driver',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('parvez.tufail@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Parvez Tufail',     '0302-6660012', 'driver',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('qaiser.mahmood@parkflowpk.com',    '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Qaiser Mahmood',    '0302-6660013', 'driver',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('roshan.sarwar@parkflowpk.com',     '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Roshan Sarwar',     '0302-6660014', 'driver',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE),
  ('sajjad.tarar@parkflowpk.com',      '$2b$10$p8f4ZNhJaHoAwhEcvXguHu8CkycML9uKLhVis9HSbY6yZaWwwV8iO', 'Sajjad Tarar',      '0302-6660015', 'driver',     '7260e49e-df79-4332-bb74-528566dbf0e0', TRUE, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- VERIFY: Final counts
-- ============================================================
SELECT 
  v.name AS venue,
  v.city,
  COUNT(u.id) FILTER (WHERE u.role = 'driver') AS drivers,
  COUNT(u.id) FILTER (WHERE u.role = 'washer') AS washers,
  COUNT(u.id) FILTER (WHERE u.role = 'supervisor') AS supervisors,
  COUNT(u.id) AS total_staff
FROM venues v
LEFT JOIN users u ON u.venue_id = v.id AND u.role IN ('driver', 'washer', 'supervisor')
GROUP BY v.id, v.name, v.city
ORDER BY v.name;

SELECT role, COUNT(*) as total FROM users GROUP BY role ORDER BY role;
