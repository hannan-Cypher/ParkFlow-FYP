-- Migration 014: Create missing tables on production (staff_invitations, staff_shifts)
-- These tables exist locally but were never migrated to the Contabo VPS.
-- Also adds missing wash_type column to service_requests.

-- ═══════════════════════════════════════════════════════════════════
-- 1. staff_invitations
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.staff_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255),
    token character varying(255) NOT NULL,
    venue_id uuid,
    invited_by uuid NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    staff_role character varying(20) DEFAULT 'driver'::character varying,
    CONSTRAINT staff_invitations_pkey PRIMARY KEY (id),
    CONSTRAINT staff_invitations_token_key UNIQUE (token),
    CONSTRAINT staff_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id),
    CONSTRAINT staff_invitations_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_email ON public.staff_invitations USING btree (email);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_token ON public.staff_invitations USING btree (token);

-- ═══════════════════════════════════════════════════════════════════
-- 2. staff_shifts
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.staff_shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    shift_start timestamp with time zone DEFAULT now() NOT NULL,
    shift_end timestamp with time zone,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    break_start timestamp with time zone,
    total_break_minutes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_late boolean DEFAULT false,
    late_minutes integer DEFAULT 0,
    admin_approval character varying(20) DEFAULT NULL::character varying,
    admin_approval_by uuid,
    admin_approval_at timestamp with time zone,
    CONSTRAINT staff_shifts_pkey PRIMARY KEY (id),
    CONSTRAINT staff_shifts_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'on_break'::character varying, 'completed'::character varying, 'pending_approval'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT staff_shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT staff_shifts_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id),
    CONSTRAINT staff_shifts_admin_approval_by_fkey FOREIGN KEY (admin_approval_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff ON public.staff_shifts USING btree (staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_venue ON public.staff_shifts USING btree (venue_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_status ON public.staff_shifts USING btree (status);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_date ON public.staff_shifts USING btree (shift_start);

-- ═══════════════════════════════════════════════════════════════════
-- 3. Add missing wash_type column to service_requests (if missing)
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'service_requests' AND column_name = 'wash_type'
    ) THEN
        ALTER TABLE public.service_requests ADD COLUMN wash_type character varying(50);
    END IF;
END $$;
