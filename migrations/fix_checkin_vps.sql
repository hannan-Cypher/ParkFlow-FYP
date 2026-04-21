-- Migration to fix Check-In 500 error on VPS
-- Created: 2026-04-21

-- 1. Create magic_links table
CREATE TABLE IF NOT EXISTS public.magic_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token character varying(64) NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT magic_links_pkey PRIMARY KEY (id),
    CONSTRAINT magic_links_token_key UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON public.magic_links USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON public.magic_links USING btree (token);

-- 2. Ensure parking_sessions has all required columns
ALTER TABLE public.parking_sessions ADD COLUMN IF NOT EXISTS requested_class varchar(20) DEFAULT 'standard';
ALTER TABLE public.parking_sessions ADD COLUMN IF NOT EXISTS pricing_metadata jsonb;
ALTER TABLE public.parking_sessions ADD COLUMN IF NOT EXISTS entry_plate_confidence numeric(5,2);
ALTER TABLE public.parking_sessions ADD COLUMN IF NOT EXISTS sms_code varchar(10);

-- 3. Add constraint for requested_class if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parking_sessions_requested_class_check') THEN
        ALTER TABLE public.parking_sessions ADD CONSTRAINT parking_sessions_requested_class_check CHECK (requested_class::text = ANY (ARRAY['standard'::character varying, 'vip'::character varying]::text[]));
    END IF;
END
$$;
