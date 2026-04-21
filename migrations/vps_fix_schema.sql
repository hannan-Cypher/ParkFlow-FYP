-- Consolidated fix for missing ANPR and Realtime components on VPS
-- Use via: psql -U Owner -d valet_parking < migrations/vps_fix_schema.sql

-- 1. Ensure anpr_logs table exists
CREATE TABLE IF NOT EXISTS public.anpr_logs (
    id SERIAL PRIMARY KEY,
    plate_number character varying(20) NOT NULL,
    confidence numeric(5,4),
    ocr_method character varying(50),
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE,
    gate_id uuid REFERENCES public.gates(id) ON DELETE CASCADE
);

-- 2. Ensure indices for anpr_logs
CREATE INDEX IF NOT EXISTS idx_anpr_logs_detected_at ON public.anpr_logs (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anpr_logs_plate ON public.anpr_logs (plate_number);

-- 3. Notification Function (if missing)
CREATE OR REPLACE FUNCTION public.notify_realtime_event() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    payload JSON;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        payload = json_build_object(
            'table', TG_TABLE_NAME,
            'action', TG_OP,
            'id', OLD.id
        );
    ELSE
        payload = json_build_object(
            'table', TG_TABLE_NAME,
            'action', TG_OP,
            'id', NEW.id,
            'data', row_to_json(NEW)
        );
    END IF;
    PERFORM pg_notify('realtime_updates', payload::text);
    RETURN NEW;
END;
$$;

-- 4. Attachment triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notify_parking_sessions_realtime') THEN
        CREATE TRIGGER notify_parking_sessions_realtime
        AFTER INSERT OR UPDATE OR DELETE ON public.parking_sessions
        FOR EACH ROW EXECUTE FUNCTION public.notify_realtime_event();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notify_anpr_logs_realtime') THEN
        CREATE TRIGGER notify_anpr_logs_realtime
        AFTER INSERT ON public.anpr_logs
        FOR EACH ROW EXECUTE FUNCTION public.notify_realtime_event();
    END IF;
END $$;
