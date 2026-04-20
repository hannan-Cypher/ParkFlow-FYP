-- ParkFlow Real-time SSE Triggers
-- This migration adds the necessary PostgreSQL functions and triggers to support event-driven UI updates.

-- 1. Create the notification function
CREATE OR REPLACE FUNCTION notify_realtime_event()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- 2. Attach triggers to core tables

-- Parking Sessions
DROP TRIGGER IF EXISTS trigger_notify_parking_sessions ON parking_sessions;
CREATE TRIGGER trigger_notify_parking_sessions
AFTER INSERT OR UPDATE OR DELETE ON parking_sessions
FOR EACH ROW EXECUTE FUNCTION notify_realtime_event();

-- Service Requests (Washes)
DROP TRIGGER IF EXISTS trigger_notify_service_requests ON service_requests;
CREATE TRIGGER trigger_notify_service_requests
AFTER INSERT OR UPDATE OR DELETE ON service_requests
FOR EACH ROW EXECUTE FUNCTION notify_realtime_event();

-- Transactions (Payments)
DROP TRIGGER IF EXISTS trigger_notify_transactions ON transactions;
CREATE TRIGGER trigger_notify_transactions
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION notify_realtime_event();

-- Users (Shift Status/Duty)
DROP TRIGGER IF EXISTS trigger_notify_users_duty ON users;
CREATE TRIGGER trigger_notify_users_duty
AFTER UPDATE OF is_active, venue_id ON users
FOR EACH ROW EXECUTE FUNCTION notify_realtime_event();
