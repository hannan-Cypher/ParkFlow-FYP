-- ============================================================
-- Fix users_role_check constraint to match application role system
-- Old constraint only allowed: customer, valet_staff, admin
-- New constraint allows: customer, driver, washer, supervisor, admin
-- ============================================================

-- Drop outdated constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add correct constraint matching the role system in lib/roles.ts
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('customer', 'driver', 'washer', 'supervisor', 'admin'));

-- Migrate any remaining valet_staff → driver (safety net)
UPDATE users SET role = 'driver' WHERE role = 'valet_staff';
