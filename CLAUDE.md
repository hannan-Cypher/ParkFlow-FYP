# ParkFlow FYP — Project Context for Claude

## Project Overview
**ParkFlow** is an AI-powered valet parking management system built as a Final Year Project (FYP).
It is a full-stack Next.js web application with a separate Python/Flask AI microservice for Automatic Number Plate Recognition (ANPR).

**Three user roles:** `admin`, `valet_staff`, `customer`
**Currency:** PKR (Pakistani Rupees)
**Target market:** Pakistan (Pakistani license plate format)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Next.js API Routes (TypeScript) |
| Database | PostgreSQL (`valet_parking` DB, `pg` Node driver) |
| Auth | Custom session tokens — 32-byte hex, 7-day expiry, HttpOnly cookie (`auth_token`) |
| Password hashing | `bcryptjs` (salt rounds: 10) |
| AI / ANPR | Python Flask microservice on port 8080 |
| ANPR model | YOLOv8m (`best.pt`) — trained for Pakistani plates |
| OCR | Hybrid: `fast-plate-ocr` (ONNX) primary + EasyOCR fallback |
| Animation | Framer Motion |

---

## Repository Structure

```
ParkFlow-FYP-main/
├── app/
│   ├── (auth)/login/            # Login page
│   ├── (dashboard)/
│   │   ├── admin/page.tsx       # Admin dashboard (7 tabs)
│   │   ├── staff/page.tsx       # Staff dashboard
│   │   └── customer/page.tsx    # Customer dashboard
│   ├── api/
│   │   ├── auth/login|logout|signup|me/route.ts
│   │   ├── sessions/
│   │   │   ├── route.ts              # GET list (role-filtered)
│   │   │   ├── checkin/route.ts      # POST check-in
│   │   │   ├── checkout/route.ts     # POST check-out
│   │   │   ├── retrieve/route.ts     # POST retrieval request
│   │   │   ├── checkout/search/route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts          # GET/PUT session by ID
│   │   │       ├── damage-photos/route.ts
│   │   │       ├── rate/route.ts
│   │   │       └── retrieval/route.ts
│   │   ├── staff/
│   │   │   ├── route.ts              # GET staff list
│   │   │   ├── me/route.ts           # GET current staff profile
│   │   │   ├── assign/route.ts       # POST assign staff
│   │   │   └── tasks/route.ts        # GET tasks for staff
│   │   ├── admin/
│   │   │   ├── stats/route.ts        # GET dashboard stats
│   │   │   └── analytics/route.ts
│   │   ├── anpr/
│   │   │   ├── detect/route.ts       # POST – proxies to Flask AI
│   │   │   ├── gallery/route.ts
│   │   │   └── stats/route.ts
│   │   ├── locations/
│   │   │   ├── route.ts              # GET/POST venues
│   │   │   └── [id]/route.ts         # GET/PUT/DELETE venue
│   │   │   └── [id]/gates/route.ts
│   │   ├── venues/
│   │   │   └── [id]/
│   │   │       ├── pricing/route.ts        # GET/PUT dynamic pricing config
│   │   │       └── current-rate/route.ts   # GET live rate
│   │   ├── customers/lookup/route.ts
│   │   ├── notify/sms/route.ts
│   │   └── signal/route.ts               # Server-Sent Events for live feed
│   ├── page.tsx                 # Landing/home page
│   └── layout.tsx
├── components/
│   ├── admin/
│   │   ├── ClientLayout.tsx
│   │   ├── OverviewTab.tsx
│   │   ├── AnalyticsTab.tsx
│   │   ├── StaffTab.tsx
│   │   ├── LocationsTab.tsx
│   │   ├── LiveFeedWidget.tsx
│   │   └── SettingsTab.tsx
│   ├── anpr/ANPRDetector.tsx
│   ├── home/
│   │   ├── Hero.tsx, Features.tsx, Services.tsx
│   │   ├── HowItWorks.tsx, Stats.tsx, Testimonials.tsx
│   │   ├── Partners.tsx, CTA.tsx
│   └── DarkModeToggle.tsx, ThemeProvider.tsx
├── lib/
│   ├── db.ts           # PostgreSQL pool (singleton pattern for hot-reload)
│   ├── auth.ts         # hashPassword, verifyPassword, generateToken, isValidEmail, isValidPassword
│   ├── getUser.ts      # getAuthUser(request) → AuthUser | null
│   └── pricingEngine.ts # calculateDynamicRate(venue_id) → pricing metadata
├── types/index.ts       # TypeScript interfaces: User, Tenant, Vehicle, ParkingSession, ANPRResult
├── model/
│   ├── app.py           # Flask ANPR server (main entry point)
│   ├── hybrid_ocr.py    # Hybrid OCR logic (fast-plate-ocr + EasyOCR)
│   ├── ocr_postprocess.py
│   └── data/detected_plates/  # Saved plate crops + detection_log.json
└── sample_data.sql      # Test seed data
```

---

## Database

**Connection:** `lib/db.ts`
- Host: `localhost:5432`
- Database: `valet_parking`
- User: `Owner`
- Pool size: 5 connections (singleton for Next.js hot-reload)

### Tables (all PKs are UUID unless stated)

#### `users`
```
id uuid PK, email varchar UNIQUE NOT NULL, password varchar NOT NULL,
full_name varchar, phone varchar, role ENUM(customer|valet_staff|admin),
venue_id uuid FK→venues, profile_image_url, is_active bool,
email_verified bool, phone_verified bool, last_login, created_at, updated_at
```

#### `venues`
```
id uuid PK, name, address, city, country(default:Pakistan),
total_slots int, gates jsonb, contact_phone, contact_email,
status ENUM(active|inactive|maintenance),
base_rate_per_hour numeric, high_occupancy_threshold int,
high_occupancy_multiplier numeric, critical_occupancy_threshold int,
critical_occupancy_multiplier numeric, peak_hours jsonb,
peak_hour_surcharge numeric, max_rate_per_hour numeric,
min_rate_per_hour numeric, is_dynamic_enabled bool, updated_at
```

#### `vehicles`
```
id uuid PK, license_plate varchar UNIQUE, owner_id uuid FK→users,
make, model, color, year int, vehicle_type(default:car),
is_primary bool, notes text
```

#### `parking_sessions`
```
id uuid PK, vehicle_id FK→vehicles, customer_id FK→users,
venue_id FK→venues, slot_id FK→parking_slots, valet_staff_id FK→users,
entry_time, exit_time, entry_image_url, exit_image_url,
entry_plate_confidence numeric, exit_plate_confidence numeric,
status ENUM(active|completed), qr_code varchar UNIQUE, sms_code,
rate_per_hour numeric(default:100), total_hours numeric, total_amount numeric,
payment_status ENUM(pending|completed), customer_notes, staff_notes,
damage_photos jsonb, damage_notes, retrieval_status, retrieval_requested_at,
rating int, rating_comment text, pricing_metadata jsonb, created_at
```

#### `parking_slots`
```
id uuid PK, venue_id FK→venues, slot_number varchar,
floor_level varchar, zone varchar,
slot_type ENUM(standard|vip|electric|disabled|compact),
status ENUM(available|occupied|maintenance),
camera_id, coordinates jsonb
```

#### `sessions` (auth sessions)
```
id uuid PK, user_id FK→users, token varchar UNIQUE, expires_at, created_at
```

#### `transactions`
```
id uuid PK, session_id FK→parking_sessions, customer_id FK→users,
amount numeric, payment_method, payment_status,
transaction_reference, payment_gateway_response jsonb
```

#### `notifications`
```
id uuid PK, user_id FK→users, title, message, type,
read bool(default:false), related_session_id
```

#### `service_requests`
```
id uuid PK, session_id, customer_id, service_type, service_status,
assigned_to FK→users, service_cost, notes, started_at, completed_at
```

#### `security_logs`
```
id uuid PK, venue_id, event_type, license_plate, image_url,
confidence_score, camera_id, description, severity ENUM(info|...)
```

---

## Authentication Flow

1. Login: `POST /api/auth/login` → verifies bcrypt password → creates session token (32-byte hex) stored in `sessions` table → sets `auth_token` HttpOnly cookie (7-day expiry)
2. Every protected API route calls `getAuthUser(request)` from `lib/getUser.ts`
3. `getAuthUser` reads `auth_token` cookie → JOINs `sessions` + `users` → returns `AuthUser { id, email, full_name, phone, role, venue_id }` or `null`
4. Logout: `POST /api/auth/logout` → deletes session row, clears cookie

**Password rules:** min 8 chars, 1 uppercase, 1 lowercase, 1 digit

---

## Core Business Logic

### Check-In (`POST /api/sessions/checkin`)
Required: `license_plate`, `venue_id`
Optional: `staff_id`, `customer_id`, `customer_phone`, `vehicle_type`, `make`, `model`, `color`, `entry_plate_confidence`, `customer_notes`

**Algorithm:**
1. Validate venue exists
2. Check no duplicate active session for plate
3. Resolve customer: explicit ID > phone lookup > vehicle owner
4. Find/create vehicle record
5. **Slot-Type Priority Allocation** (PostgreSQL `FOR UPDATE SKIP LOCKED`):
   - `sedan` → [standard, vip, electric, compact]
   - `suv` → [standard, vip, electric]
   - `pickup`/`van` → [standard, vip]
   - `hatchback` → [compact, standard, electric, vip]
   - `car` → [standard, compact, vip, electric]
   - Ultimate fallback: any available slot
6. Mark slot as `occupied`
7. **Auto Staff Assignment**: picks least-busy (fewest active sessions) valet_staff at venue
8. Calculate dynamic rate via `calculateDynamicRate(venue_id)` → stored as `pricing_metadata` (jsonb)
9. Insert `parking_sessions` row, set `qr_code = session.id`
10. COMMIT, return enriched session object

### Check-Out (`POST /api/sessions/checkout`)
Required: `session_id` OR `license_plate`

**Algorithm:**
1. Find active session (with `FOR UPDATE` lock)
2. Calculate duration: `exitTime - entryTime`
3. Billing: `billedHours = max(ceil(totalHours), 1)`, `total = billedHours × rate_per_hour`
4. Free slot → `status = 'available'`
5. Update session: `status='completed'`, `payment_status='completed'`, set `exit_time`, `total_hours`, `total_amount`
6. Insert notification for customer
7. COMMIT, return summary

### Dynamic Pricing (`lib/pricingEngine.ts` + `GET|PUT /api/venues/[id]/pricing`)
Per-venue config stored in `venues` table:
- `base_rate_per_hour` — default base rate
- `high_occupancy_threshold` (%) → apply `high_occupancy_multiplier`
- `critical_occupancy_threshold` (%) → apply `critical_occupancy_multiplier`
- `peak_hours` (jsonb array of hour ranges) → add `peak_hour_surcharge`
- `min_rate_per_hour` / `max_rate_per_hour` — clamp boundaries
- `is_dynamic_enabled` — toggle (false = always use base rate)

---

## ANPR / AI Service (`model/app.py`)

**Flask server on port 8080** — must be started separately.

**Flask Routes:**
- `GET /health` → `{ status: 'ok', model_loaded: true }`
- `POST /detect` → Body: `{ image: base64DataURL, user_info: string }` → detects plates, runs OCR, returns plate crops + text
- `GET /stats` → last 10 detections, counters, file paths
- `GET /gallery` → list of saved plate image filenames
- `GET /plates/<filename>` → serve plate crop image
- `GET /frames/<filename>` → serve full annotated frame

**YOLO Model:** `best.pt` (YOLOv8m, conf threshold 0.5, imgsz 640)
**Model files are in `.gitignore`** — not committed.

**OCR Pipeline (Hybrid):**
1. Primary: `fast-plate-ocr` (ONNX, fast)
2. Fallback: EasyOCR with 7-step preprocessing:
   - 3× upscale → grayscale → bilateral denoise → histogram equalization → CLAHE → unsharp mask → Otsu binarization (inverted)
3. Pakistani-plate-specific noise removal:
   - Year badge masking (top-right corner, 2-digit year like `16`)
   - City/province strip masking (bottom 15% — "ICT-ISLAMABAD", "PUNJAB", etc.)
   - Spatial filters (year-box, city-box) applied during OCR result parsing
4. Plate format validation: `LETTERS(2-4)-DIGITS(1-5)` e.g. `LEA-1234`, `MNA-877`
5. Year-strip layer 3 defence: `CITY+YY+REG → CITY+REG`

**Next.js → Flask proxy:** `POST /api/anpr/detect` proxies to `FLASK_AI_URL` (env var, default `http://localhost:8080`)

---

## Dashboard Pages

### Admin (`/admin`) — 7 Tabs
1. **Overview** — real-time stats widgets (venues, slots, sessions, revenue, staff, customers), recent activity feed
2. **Analytics** — charts (occupancy, revenue, sessions over time)
3. **Staff** — staff list with assignment to venues, active task counts
4. **Locations** — venue CRUD, pricing config per venue
5. **Live Feed** — real-time parking activity via SSE (`/api/signal`)
6. **ANPR** — camera feed + plate detection UI (`ANPRDetector` component)
7. **Settings** — system/venue configuration

### Staff (`/staff`)
- Active tasks (assigned sessions at their venue)
- Completed today

### Customer (`/customer`)
- Active sessions
- Session history
- Car retrieval requests

---

## API Routes Reference

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Email+password login, sets cookie |
| POST | `/api/auth/signup` | Create new account |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current user profile |

### Sessions
| Method | Route | Description |
|---|---|---|
| GET | `/api/sessions` | List sessions (role-filtered, ?status=active|completed|all, ?venue_id) |
| POST | `/api/sessions/checkin` | Check in vehicle |
| POST | `/api/sessions/checkout` | Check out vehicle |
| GET | `/api/sessions/checkout/search` | Search session for checkout |
| POST | `/api/sessions/retrieve` | Request car retrieval |
| GET/PUT | `/api/sessions/[id]` | Get or update specific session |
| POST | `/api/sessions/[id]/damage-photos` | Upload damage photos |
| POST | `/api/sessions/[id]/rate` | Rate session (1-5 stars + comment) |
| GET/POST | `/api/sessions/[id]/retrieval` | Retrieval status management |

### Staff
| Method | Route | Description |
|---|---|---|
| GET | `/api/staff` | List all staff |
| GET | `/api/staff/me` | Current staff member profile |
| POST | `/api/staff/assign` | Assign staff to venue |
| GET | `/api/staff/tasks` | Tasks for current staff |

### Admin
| Method | Route | Description |
|---|---|---|
| GET | `/api/admin/stats` | Real-time system stats |
| GET | `/api/admin/analytics` | Historical analytics data |

### Venues / Locations
| Method | Route | Description |
|---|---|---|
| GET/POST | `/api/locations` | List / create venues |
| GET/PUT/DELETE | `/api/locations/[id]` | Venue CRUD |
| GET/PUT | `/api/venues/[id]/pricing` | Dynamic pricing config |
| GET | `/api/venues/[id]/current-rate` | Current live rate for a venue |

### ANPR
| Method | Route | Description |
|---|---|---|
| POST | `/api/anpr/detect` | Detect plates (proxies to Flask) |
| GET | `/api/anpr/gallery` | Plate image gallery |
| GET | `/api/anpr/stats` | Detection statistics |

### Other
| Method | Route | Description |
|---|---|---|
| GET | `/api/customers/lookup` | Find customer by phone/plate |
| POST | `/api/notify/sms` | Send SMS notification |
| GET | `/api/signal` | SSE stream for live feed |

---

## TypeScript Interfaces (`types/index.ts`)

```typescript
interface User {
  id: number; email: string; phone: string; full_name: string;
  role: "customer" | "valet_staff" | "admin" | "super_admin";
  tenant_id?: number; loyalty_points?: number; is_active: boolean; created_at: string;
}

interface Vehicle {
  id: number; license_plate: string; make?: string; model?: string;
  color?: string; year?: number; owner_id: number; created_at: string;
}

interface ParkingSession {
  id: number; license_plate: string; vehicle_id?: number;
  customer_id: number; valet_staff_id?: number; slot_number?: string;
  entry_time: string; exit_time?: string; total_hours: number;
  total_amount: number; cleaning_requested: boolean; cleaning_completed: boolean;
  status: "active" | "completed" | "cancelled"; entry_image_url?: string;
}

interface ANPRResult {
  success: boolean; plate_detected: boolean; confidence: number; plate_text: string;
  bbox?: { x1: number; y1: number; x2: number; y2: number; };
}

interface AuthUser {  // from lib/getUser.ts
  id: string; email: string; full_name: string; phone: string;
  role: 'admin' | 'valet_staff' | 'customer'; venue_id: string | null;
}
```

---

## Sample / Test Data (`sample_data.sql`)

- **31 total users:** 3 admin, 8 valet_staff, 20 customer
- **All passwords:** `password123`
- **5 Venues (all active, 100 slots each in DB):**
  | Venue | City | Capacity |
  |---|---|---|
  | Centaurus Mall | Islamabad | 500 |
  | Dolmen Mall Clifton | Karachi | 700 |
  | Emporium Mall | Lahore | 800 |
  | Lucky One Mall | Karachi | 1000 |
  | Packages Mall | Lahore | 600 |
- **Slot inventory:** standard(3400), electric(100), vip(50), disabled(50) — all available
- **Sessions:** 7 completed, 0 active

---

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `FLASK_AI_URL` | URL of Flask ANPR service | `http://localhost:8080` |
| `MODEL_PATH` | Path to YOLO model weights | `model/best.pt` |
| `ANPR_STORAGE_PATH` | Where to save plate crops | `model/data/detected_plates` |
| `PORT` (Flask) | Flask server port | `8080` |
| DB credentials | Hardcoded in `lib/db.ts` (should be env vars) | — |

---

## Dark Mode
- Tailwind `darkMode: 'class'` strategy
- `ThemeProvider` React context wraps the app
- `DarkModeToggle` component toggles `dark` class on `<html>`

---

## Known Issues / Notes

1. **DB credentials hardcoded** in `lib/db.ts` — should be moved to env vars
2. **Flask AI service** must be started separately before using ANPR features
3. **ANPR model files** (`best.pt`, `yolov8m.pt`) are in `.gitignore` — not in repo
4. **`types/index.ts`** uses `number` IDs but actual DB uses `uuid` — slight mismatch, `lib/getUser.ts` uses `string` IDs (uuid)
5. SSE live feed via `/api/signal`
6. Real-time rate changes broadcast to all connected admin dashboards

---

## Development Setup

```bash
# 1. Install Next.js dependencies
npm install

# 2. Start Next.js dev server
npm run dev          # http://localhost:3000

# 3. Start Flask ANPR service (in separate terminal)
cd model
pip install flask flask-cors ultralytics easyocr opencv-python fast-plate-ocr
python app.py        # http://localhost:8080

# 4. PostgreSQL must be running with:
#    - database: valet_parking
#    - user: Owner
#    - Load schema + seed: psql -U Owner -d valet_parking -f sample_data.sql
```

---

## Key Patterns & Conventions

- **All API routes** use `NextRequest` / `NextResponse` from `next/server`
- **DB queries** use parameterized `$1, $2, ...` — never string interpolation
- **Transactions** use `BEGIN / COMMIT / ROLLBACK` with `pool.connect()` → `client.release()`
- **Slot locking:** `FOR UPDATE SKIP LOCKED` prevents race conditions on concurrent check-ins
- **Role checks:** Always call `getAuthUser(request)` and check `user.role` before sensitive ops
- **Billing:** `Math.ceil(totalHours)`, minimum 1 hour, rate stored per-session at time of check-in
- **QR code:** equals the session UUID (`qr_code = session.id`)
- **File refs:** Use `@/` alias (maps to project root) for imports

---

---

## Change Log (tracked by Claude)

### 2026-03-13 — QR Code Generation & Display Feature
**Status:** Prompt created, pending implementation
**Prompt file:** `QR_CODE_IMPLEMENTATION_PROMPT.md`

**What's being added:**
- New reusable component: `components/shared/QRCodeDisplay.tsx` (ticket + compact variants, download/copy/enlarge actions)
- New API route: `GET /api/sessions/qr/[code]` — QR-based session lookup (role-filtered)
- New public page: `/ticket/[id]` — QR scan landing page (no auth, mobile-first)
- New public API: `POST /api/public/retrieve` — car retrieval from QR scan page (session_id + plate as lightweight auth)
- Package added: `qrcode.react@4`
- Modified: staff dashboard (QR on check-in success), customer dashboard (Show QR on active sessions), checkout search (compact QR on results), checkin API (ensure response includes venue_name, slot_number), types/index.ts (added qr_code, venue_name, slot_number, retrieval_status fields)

**Key design decisions:**
- QR value = raw session UUID (matches existing `qr_code = session.id` convention)
- Error correction level M (15% damage tolerance)
- QR always white background even in dark mode (scanning reliability)
- Ticket variant has tear-line divider effect with notch circles
- Public ticket page doesn't expose sensitive data (no phone, no pricing_metadata, no staff info)
- Public retrieval requires both session_id AND license_plate as lightweight auth

### 2026-03-13 — WhatsApp Deep Link Notification (Check-In Flow Overhaul)
**Status:** Prompt created, pending implementation
**Prompt file:** `WHATSAPP_DEEPLINK_PROMPT.md`

**What's being added:**
- New utility: `lib/whatsapp.ts` — phone normalization (Pakistani formats), wa.me URL builders, phone validation
- New components: `components/staff/PhoneInput.tsx`, `components/staff/CustomerLookupResult.tsx`, `components/staff/CheckInStepIndicator.tsx`
- Staff check-in flow overhauled into 5-step wizard: Scan → Customer → Vehicle → Confirm → Success
- Enhanced: `GET /api/customers/lookup` — now supports phone+plate combined lookup, returns visit count, vehicle history, phone format normalization
- Enhanced: `POST /api/sessions/checkin` response — now includes venue_name, slot_number, customer_name, customer_phone via JOINs
- WhatsApp integration: wa.me deep link with pre-filled message, opens in staff's WhatsApp, zero cost

**Key design decisions:**
- wa.me deep link (NOT WhatsApp Business API) — completely free, no accounts/BSP needed
- Phone normalization handles all Pakistani formats: 03xx, 3xx, +923xx, 923xx, with dashes/spaces
- Customer lookup is debounced (300ms) with AbortController cancellation
- Returning customers get shorter WhatsApp message; new customers get full ticket message
- "Skip — No Phone" option for walk-ins — WhatsApp button hidden, QR ticket handed directly
- No phone number ever sent to any third party — wa.me opens locally on staff's device
- No new packages needed — pure URL construction
- Messages use bilingual format: Urdu greeting ("Assalam-o-Alaikum") + English body + Urdu closing instruction
- Messages include: plate, venue, slot, rate (PKR/hr), SMS code (4-char offline backup), venue helpline phone, ticket link
- SMS code generated at check-in (4-char alphanumeric, avoids ambiguous chars 0/O/1/I/L/5/S/8/B), stored in parking_sessions.sms_code
- Checkout search enhanced to find sessions by SMS code (offline fallback for customers without internet)

**Flow:**
ANPR scan → plate confirmed → staff enters phone → live customer lookup → returning/new badge → optional vehicle details → confirm → check-in → QR ticket + "Send via WhatsApp" button

---

*This file is auto-loaded by Claude Code in every session for this project.*