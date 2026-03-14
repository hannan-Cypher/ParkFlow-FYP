-- =====================================================
-- MIGRATION: Phone-primary auth + magic links
-- =====================================================

-- 1. Make email NULLABLE (it's now optional for customers)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- 2. Add UNIQUE constraint on phone (it's now the primary identifier)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone);
  END IF;
END $$;

-- 3. Create magic_links table for auto-login tokens
CREATE TABLE IF NOT EXISTS magic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token varchar(64) UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES parking_sessions(id) ON DELETE CASCADE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone DEFAULT NOW()
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON magic_links(expires_at);
