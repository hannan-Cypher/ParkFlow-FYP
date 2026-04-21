--
-- PostgreSQL database dump
--

\restrict v0MlHBIxaX21pXKcT8cKs1bg7E45sgoawn7yHLBTqqowmkWgC2F6TFlcxvxgwVM

-- Dumped from database version 15.15 (Homebrew)
-- Dumped by pg_dump version 15.15 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: notify_realtime_event(); Type: FUNCTION; Schema: public; Owner: Owner
--

CREATE FUNCTION public.notify_realtime_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


ALTER FUNCTION public.notify_realtime_event() OWNER TO "Owner";

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: Owner
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO "Owner";

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: anpr_logs; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.anpr_logs (
    id integer NOT NULL,
    plate_number character varying(20) NOT NULL,
    confidence numeric(5,4),
    ocr_method character varying(50),
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    venue_id uuid
);


ALTER TABLE public.anpr_logs OWNER TO "Owner";

--
-- Name: anpr_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: Owner
--

CREATE SEQUENCE public.anpr_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.anpr_logs_id_seq OWNER TO "Owner";

--
-- Name: anpr_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Owner
--

ALTER SEQUENCE public.anpr_logs_id_seq OWNED BY public.anpr_logs.id;


--
-- Name: gates; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.gates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    venue_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.gates OWNER TO "Owner";

--
-- Name: magic_links; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.magic_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token character varying(64) NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.magic_links OWNER TO "Owner";

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50),
    read boolean DEFAULT false,
    related_session_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO "Owner";

--
-- Name: parking_sessions; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.parking_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid NOT NULL,
    customer_id uuid,
    venue_id uuid NOT NULL,
    slot_id uuid,
    valet_staff_id uuid,
    entry_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    exit_time timestamp without time zone,
    entry_image_url text,
    exit_image_url text,
    entry_plate_confidence numeric(5,2),
    exit_plate_confidence numeric(5,2),
    status character varying(20) DEFAULT 'active'::character varying,
    qr_code text,
    sms_code character varying(10),
    rate_per_hour numeric(10,2) DEFAULT 100.00,
    total_hours numeric(10,2),
    total_amount numeric(10,2),
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    customer_notes text,
    staff_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    pricing_metadata jsonb,
    rating integer,
    rating_comment text,
    damage_photos jsonb DEFAULT '[]'::jsonb,
    damage_notes text,
    retrieval_status text,
    retrieval_requested_at timestamp with time zone,
    requested_class character varying(20) DEFAULT 'standard'::character varying,
    CONSTRAINT parking_sessions_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT parking_sessions_requested_class_check CHECK (((requested_class)::text = ANY ((ARRAY['standard'::character varying, 'vip'::character varying])::text[])))
);


ALTER TABLE public.parking_sessions OWNER TO "Owner";

--
-- Name: parking_slots; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.parking_slots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    venue_id uuid NOT NULL,
    slot_number character varying(50) NOT NULL,
    floor_level character varying(20),
    zone character varying(50),
    slot_type character varying(50) DEFAULT 'standard'::character varying,
    status character varying(20) DEFAULT 'available'::character varying,
    camera_id character varying(100),
    coordinates jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    zone_id uuid,
    gate_id uuid,
    CONSTRAINT chk_parking_slots_status CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'occupied'::character varying, 'reserved'::character varying, 'maintenance'::character varying])::text[])))
);


ALTER TABLE public.parking_slots OWNER TO "Owner";

--
-- Name: security_logs; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.security_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    venue_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    license_plate character varying(50),
    image_url text,
    confidence_score numeric(5,2),
    camera_id character varying(100),
    description text,
    severity character varying(20) DEFAULT 'info'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.security_logs OWNER TO "Owner";

--
-- Name: service_requests; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.service_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    service_type character varying(50) NOT NULL,
    service_status character varying(20) DEFAULT 'pending'::character varying,
    assigned_to uuid,
    service_cost numeric(10,2),
    notes text,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    wash_type character varying(50),
    before_photos jsonb DEFAULT '[]'::jsonb,
    after_photos jsonb DEFAULT '[]'::jsonb,
    vehicle_id uuid,
    venue_id uuid,
    slot_id uuid
);


ALTER TABLE public.service_requests OWNER TO "Owner";

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.sessions OWNER TO "Owner";

--
-- Name: staff_duty_assignments; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.staff_duty_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    zone_id uuid,
    assigned_by uuid NOT NULL,
    role character varying(20) NOT NULL,
    assigned_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.staff_duty_assignments OWNER TO "Owner";

--
-- Name: staff_invitations; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.staff_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255),
    token character varying(255) NOT NULL,
    venue_id uuid,
    invited_by uuid NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    staff_role character varying(20) DEFAULT 'driver'::character varying
);


ALTER TABLE public.staff_invitations OWNER TO "Owner";

--
-- Name: staff_shifts; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.staff_shifts (
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
    CONSTRAINT staff_shifts_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'on_break'::character varying, 'completed'::character varying, 'pending_approval'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.staff_shifts OWNER TO "Owner";

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    session_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_method character varying(50),
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    transaction_reference character varying(255),
    payment_gateway_response jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.transactions OWNER TO "Owner";

--
-- Name: users; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255),
    password character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    role character varying(20) DEFAULT 'customer'::character varying NOT NULL,
    venue_id uuid,
    profile_image_url text,
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    phone_verified boolean DEFAULT false,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'active'::character varying,
    zone_id uuid,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['customer'::character varying, 'driver'::character varying, 'washer'::character varying, 'supervisor'::character varying, 'admin'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO "Owner";

--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    license_plate character varying(50) NOT NULL,
    owner_id uuid,
    make character varying(100),
    model character varying(100),
    color character varying(50),
    year integer,
    vehicle_type character varying(50) DEFAULT 'car'::character varying,
    is_primary boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.vehicles OWNER TO "Owner";

--
-- Name: venues; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.venues (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    address text NOT NULL,
    city character varying(100) NOT NULL,
    country character varying(100) DEFAULT 'Pakistan'::character varying NOT NULL,
    total_slots integer DEFAULT 0 NOT NULL,
    contact_phone character varying(20),
    contact_email character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    gates integer DEFAULT 1 NOT NULL,
    base_rate_per_hour numeric(10,2) DEFAULT 150.00,
    high_occupancy_threshold integer DEFAULT 80,
    high_occupancy_multiplier numeric(4,2) DEFAULT 1.5,
    critical_occupancy_threshold integer DEFAULT 95,
    critical_occupancy_multiplier numeric(4,2) DEFAULT 2.0,
    peak_hours jsonb DEFAULT '[{"end": "10:00", "label": "Morning Rush", "start": "08:00"}, {"end": "20:00", "label": "Evening Rush", "start": "17:00"}]'::jsonb,
    peak_hour_surcharge numeric(10,2) DEFAULT 50.00,
    max_rate_per_hour numeric(10,2) DEFAULT 500.00,
    min_rate_per_hour numeric(10,2) DEFAULT 100.00,
    is_dynamic_enabled boolean DEFAULT true,
    shift_start_time time without time zone DEFAULT '09:00:00'::time without time zone,
    shift_end_time time without time zone DEFAULT '18:00:00'::time without time zone,
    max_break_minutes integer DEFAULT 30,
    enforce_shift_start_window boolean DEFAULT true,
    vip_base_rate_per_hour numeric DEFAULT 0,
    vip_high_occupancy_multiplier numeric DEFAULT 1.5,
    vip_critical_occupancy_multiplier numeric DEFAULT 2.0,
    CONSTRAINT venues_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'maintenance'::character varying])::text[])))
);


ALTER TABLE public.venues OWNER TO "Owner";

--
-- Name: zones; Type: TABLE; Schema: public; Owner: Owner
--

CREATE TABLE public.zones (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gate_id uuid NOT NULL,
    venue_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    total_slots integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_vip boolean DEFAULT false
);


ALTER TABLE public.zones OWNER TO "Owner";

--
-- Name: anpr_logs id; Type: DEFAULT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.anpr_logs ALTER COLUMN id SET DEFAULT nextval('public.anpr_logs_id_seq'::regclass);


--
-- Name: anpr_logs anpr_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.anpr_logs
    ADD CONSTRAINT anpr_logs_pkey PRIMARY KEY (id);


--
-- Name: gates gates_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.gates
    ADD CONSTRAINT gates_pkey PRIMARY KEY (id);


--
-- Name: gates gates_venue_id_name_key; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.gates
    ADD CONSTRAINT gates_venue_id_name_key UNIQUE (venue_id, name);


--
-- Name: magic_links magic_links_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.magic_links
    ADD CONSTRAINT magic_links_pkey PRIMARY KEY (id);


--
-- Name: magic_links magic_links_token_key; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.magic_links
    ADD CONSTRAINT magic_links_token_key UNIQUE (token);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: parking_sessions parking_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_sessions
    ADD CONSTRAINT parking_sessions_pkey PRIMARY KEY (id);


--
-- Name: parking_sessions parking_sessions_qr_code_key; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_sessions
    ADD CONSTRAINT parking_sessions_qr_code_key UNIQUE (qr_code);


--
-- Name: parking_slots parking_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_pkey PRIMARY KEY (id);


--
-- Name: parking_slots parking_slots_venue_id_slot_number_key; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_venue_id_slot_number_key UNIQUE (venue_id, slot_number);


--
-- Name: security_logs security_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.security_logs
    ADD CONSTRAINT security_logs_pkey PRIMARY KEY (id);


--
-- Name: service_requests service_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: staff_duty_assignments staff_duty_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_duty_assignments
    ADD CONSTRAINT staff_duty_assignments_pkey PRIMARY KEY (id);


--
-- Name: staff_invitations staff_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_pkey PRIMARY KEY (id);


--
-- Name: staff_invitations staff_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_token_key UNIQUE (token);


--
-- Name: staff_shifts staff_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_unique; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_unique UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_license_plate_key; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_license_plate_key UNIQUE (license_plate);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: venues venues_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_pkey PRIMARY KEY (id);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: zones zones_venue_id_name_key; Type: CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_venue_id_name_key UNIQUE (venue_id, name);


--
-- Name: idx_anpr_logs_detected_at; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_anpr_logs_detected_at ON public.anpr_logs USING btree (detected_at DESC);


--
-- Name: idx_anpr_logs_plate; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_anpr_logs_plate ON public.anpr_logs USING btree (plate_number);


--
-- Name: idx_duty_assignments_staff; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_duty_assignments_staff ON public.staff_duty_assignments USING btree (staff_id);


--
-- Name: idx_duty_assignments_venue; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_duty_assignments_venue ON public.staff_duty_assignments USING btree (venue_id);


--
-- Name: idx_gates_venue; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_gates_venue ON public.gates USING btree (venue_id);


--
-- Name: idx_magic_links_expires; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_magic_links_expires ON public.magic_links USING btree (expires_at);


--
-- Name: idx_magic_links_token; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_magic_links_token ON public.magic_links USING btree (token);


--
-- Name: idx_parking_sessions_customer; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_parking_sessions_customer ON public.parking_sessions USING btree (customer_id);


--
-- Name: idx_parking_sessions_status; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_parking_sessions_status ON public.parking_sessions USING btree (status);


--
-- Name: idx_parking_sessions_vehicle; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_parking_sessions_vehicle ON public.parking_sessions USING btree (vehicle_id);


--
-- Name: idx_parking_sessions_venue; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_parking_sessions_venue ON public.parking_sessions USING btree (venue_id);


--
-- Name: idx_parking_slots_gate_id; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_parking_slots_gate_id ON public.parking_slots USING btree (gate_id);


--
-- Name: idx_parking_slots_status; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_parking_slots_status ON public.parking_slots USING btree (status);


--
-- Name: idx_parking_slots_venue; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_parking_slots_venue ON public.parking_slots USING btree (venue_id);


--
-- Name: idx_parking_slots_zone_id; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_parking_slots_zone_id ON public.parking_slots USING btree (zone_id);


--
-- Name: idx_service_requests_assigned_status; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_service_requests_assigned_status ON public.service_requests USING btree (assigned_to, service_status);


--
-- Name: idx_service_requests_venue_type; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_service_requests_venue_type ON public.service_requests USING btree (venue_id, service_type);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (token);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_staff_invitations_email; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_staff_invitations_email ON public.staff_invitations USING btree (email);


--
-- Name: idx_staff_invitations_token; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_staff_invitations_token ON public.staff_invitations USING btree (token);


--
-- Name: idx_staff_shifts_date; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_staff_shifts_date ON public.staff_shifts USING btree (shift_start);


--
-- Name: idx_staff_shifts_staff; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_staff_shifts_staff ON public.staff_shifts USING btree (staff_id);


--
-- Name: idx_staff_shifts_status; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_staff_shifts_status ON public.staff_shifts USING btree (status);


--
-- Name: idx_staff_shifts_venue; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_staff_shifts_venue ON public.staff_shifts USING btree (venue_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_phone; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_users_phone ON public.users USING btree (phone);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: idx_users_zone; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_users_zone ON public.users USING btree (zone_id);


--
-- Name: idx_vehicles_license_plate; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_vehicles_license_plate ON public.vehicles USING btree (license_plate);


--
-- Name: idx_vehicles_owner; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_vehicles_owner ON public.vehicles USING btree (owner_id);


--
-- Name: idx_zones_gate; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_zones_gate ON public.zones USING btree (gate_id);


--
-- Name: idx_zones_venue; Type: INDEX; Schema: public; Owner: Owner
--

CREATE INDEX idx_zones_venue ON public.zones USING btree (venue_id);


--
-- Name: uq_parking_sessions_active_slot; Type: INDEX; Schema: public; Owner: Owner
--

CREATE UNIQUE INDEX uq_parking_sessions_active_slot ON public.parking_sessions USING btree (slot_id) WHERE (((status)::text = 'active'::text) AND (slot_id IS NOT NULL));


--
-- Name: parking_sessions trigger_notify_parking_sessions; Type: TRIGGER; Schema: public; Owner: Owner
--

CREATE TRIGGER trigger_notify_parking_sessions AFTER INSERT OR DELETE OR UPDATE ON public.parking_sessions FOR EACH ROW EXECUTE FUNCTION public.notify_realtime_event();


--
-- Name: service_requests trigger_notify_service_requests; Type: TRIGGER; Schema: public; Owner: Owner
--

CREATE TRIGGER trigger_notify_service_requests AFTER INSERT OR DELETE OR UPDATE ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.notify_realtime_event();


--
-- Name: users trigger_notify_users_duty; Type: TRIGGER; Schema: public; Owner: Owner
--

CREATE TRIGGER trigger_notify_users_duty AFTER UPDATE OF is_active, venue_id ON public.users FOR EACH ROW EXECUTE FUNCTION public.notify_realtime_event();


--
-- Name: gates update_gates_updated_at; Type: TRIGGER; Schema: public; Owner: Owner
--

CREATE TRIGGER update_gates_updated_at BEFORE UPDATE ON public.gates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: parking_sessions update_parking_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: Owner
--

CREATE TRIGGER update_parking_sessions_updated_at BEFORE UPDATE ON public.parking_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: parking_slots update_parking_slots_updated_at; Type: TRIGGER; Schema: public; Owner: Owner
--

CREATE TRIGGER update_parking_slots_updated_at BEFORE UPDATE ON public.parking_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: Owner
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vehicles update_vehicles_updated_at; Type: TRIGGER; Schema: public; Owner: Owner
--

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: venues update_venues_updated_at; Type: TRIGGER; Schema: public; Owner: Owner
--

CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: zones update_zones_updated_at; Type: TRIGGER; Schema: public; Owner: Owner
--

CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: anpr_logs anpr_logs_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.anpr_logs
    ADD CONSTRAINT anpr_logs_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id);


--
-- Name: gates gates_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.gates
    ADD CONSTRAINT gates_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;


--
-- Name: magic_links magic_links_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.magic_links
    ADD CONSTRAINT magic_links_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.parking_sessions(id) ON DELETE CASCADE;


--
-- Name: magic_links magic_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.magic_links
    ADD CONSTRAINT magic_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_related_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_related_session_id_fkey FOREIGN KEY (related_session_id) REFERENCES public.parking_sessions(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: parking_sessions parking_sessions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_sessions
    ADD CONSTRAINT parking_sessions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: parking_sessions parking_sessions_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_sessions
    ADD CONSTRAINT parking_sessions_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.parking_slots(id) ON DELETE SET NULL;


--
-- Name: parking_sessions parking_sessions_valet_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_sessions
    ADD CONSTRAINT parking_sessions_valet_staff_id_fkey FOREIGN KEY (valet_staff_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: parking_sessions parking_sessions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_sessions
    ADD CONSTRAINT parking_sessions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: parking_sessions parking_sessions_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_sessions
    ADD CONSTRAINT parking_sessions_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;


--
-- Name: parking_slots parking_slots_gate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_gate_id_fkey FOREIGN KEY (gate_id) REFERENCES public.gates(id) ON DELETE CASCADE;


--
-- Name: parking_slots parking_slots_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;


--
-- Name: parking_slots parking_slots_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- Name: security_logs security_logs_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.security_logs
    ADD CONSTRAINT security_logs_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;


--
-- Name: service_requests service_requests_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: service_requests service_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: service_requests service_requests_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.parking_sessions(id) ON DELETE CASCADE;


--
-- Name: service_requests service_requests_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.parking_slots(id) ON DELETE SET NULL;


--
-- Name: service_requests service_requests_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: service_requests service_requests_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.service_requests
    ADD CONSTRAINT service_requests_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_duty_assignments staff_duty_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_duty_assignments
    ADD CONSTRAINT staff_duty_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: staff_duty_assignments staff_duty_assignments_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_duty_assignments
    ADD CONSTRAINT staff_duty_assignments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_duty_assignments staff_duty_assignments_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_duty_assignments
    ADD CONSTRAINT staff_duty_assignments_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id);


--
-- Name: staff_duty_assignments staff_duty_assignments_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_duty_assignments
    ADD CONSTRAINT staff_duty_assignments_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: staff_invitations staff_invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id);


--
-- Name: staff_invitations staff_invitations_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE SET NULL;


--
-- Name: staff_shifts staff_shifts_admin_approval_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_admin_approval_by_fkey FOREIGN KEY (admin_approval_by) REFERENCES public.users(id);


--
-- Name: staff_shifts staff_shifts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_shifts staff_shifts_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id);


--
-- Name: transactions transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.parking_sessions(id) ON DELETE CASCADE;


--
-- Name: users users_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE SET NULL;


--
-- Name: users users_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: vehicles vehicles_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: zones zones_gate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_gate_id_fkey FOREIGN KEY (gate_id) REFERENCES public.gates(id) ON DELETE CASCADE;


--
-- Name: zones zones_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: Owner
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict v0MlHBIxaX21pXKcT8cKs1bg7E45sgoawn7yHLBTqqowmkWgC2F6TFlcxvxgwVM

