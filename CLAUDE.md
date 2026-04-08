# ParkFlow FYP — System Prompt & Rules

**Project:** ParkFlow (AI-powered valet parking management system for the Pakistani market).
**Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, PostgreSQL, Python/Flask (AI Microservice).

## Core Directives
1. **Always Read Context:** Before writing code, read `ARCHITECTURE.md` for database schemas, repository structure, and API routes. Read `CHANGELOG.md` for current active bugs and sprint tasks.
2. **Never Guess Schemas:** If you are unsure about a database column or a TypeScript interface, search the codebase first. Do not invent columns or types.

## Strict Architectural Rules
1. **Relational Data & Lookups (1-to-N):**
   A Customer (`users` table) can own MULTIPLE `vehicles`. When looking up a vehicle by `license_plate`, you MUST return the specific vehicle that matches the plate. Do NOT just query the customer and return their default/first vehicle. 
   
2. **No Silent UI Fallbacks (Error Handling):**
   Do not hide API errors in `.catch()` blocks by silently routing the user to another step (e.g., forcing a user to a "Phone" step if a plate lookup fails). If a fetch fails, display a toast (`react-hot-toast` or similar) so the failure is visible to the developer/user.

3. **Data Completeness & UI Steps:**
   Never remove frontend input fields (like vehicle Make/Model/Color) if it results in database records being created with `NULL` values for core business entities. "Ghost records" are strictly forbidden. If a vehicle is new, the UI MUST collect its details.

4. **User Creation & Fake Data:**
   Do NOT generate fake or mock data to bypass database constraints. (e.g., Do not generate fake `guest_1234@parkflow.pk` emails to bypass the `users` table `UNIQUE` email constraint). Handle guest checkout flows properly by either making the email column nullable for guests, using a dedicated guest table, or enforcing phone-based auth.

5. **CRITICAL TYPE RULE (UUID vs Number):**
   The database uses `uuid` (strings) for primary keys, but `types/index.ts` currently defines them as `number`. When writing frontend or API code, you MUST cast database UUIDs to strings or update the TypeScript interfaces to accept `string | number` to prevent build errors. Do not attempt to parse UUIDs as integers.

6. **Database Transactions:**
   Always use parameterized queries (`$1, $2`) to prevent SQL injection. Use the `FOR UPDATE SKIP LOCKED` pattern for slot allocation to prevent concurrent check-in race conditions.

7. **Role Values — DB ↔ App Sync:**
   The ONLY valid user roles are: `customer`, `driver`, `washer`, `supervisor`, `admin`. The old `valet_staff` role is DEPRECATED and must NEVER be used in seed data or migrations. The DB has a `users_role_check` CHECK constraint enforcing this. When writing seed SQL, always use the expanded roles (`driver`/`washer`/`supervisor`), never the legacy `valet_staff`. The admin staff API filters by `WHERE role IN ('driver','washer','supervisor')`.

8. **Migration ↔ API Column Sync:**
   Before inserting into any table from an API route, verify every column referenced in the INSERT statement actually exists in the table's migration. Missing columns cause silent 500 errors (e.g., `staff_invitations.staff_role` was missing from the migration but used in the API).

35. **License Plate Canonical Format:**
   All license plates MUST be stored and queried in a single canonical format: **uppercase with all spaces and hyphens stripped** (e.g., `ABC123`, not `ABC 123` or `ABC-123`). Apply `plate.trim().toUpperCase().replace(/[\s\-]+/g, '')` before any INSERT or SELECT. The `customers/lookup` SQL query uses `REPLACE(REPLACE(UPPER(...), ' ', ''), '-', '')` on both sides of the comparison to remain backward-compatible with any legacy data.

10. **SMS Code Lookup Checkout:**
    Staff dashboard filters active sessions locally for checkout using the `sms_code`, `license_plate`, and `customer_name`. The `sms_code` is fetched alongside other session details from `GET /api/sessions`.

11. **Staff Email Domain Standard:**
    All staff members (`driver`, `washer`, `supervisor`) MUST have their email accounts created under the `@parkflowpk.com` domain. Venue-specific subdomains (e.g., `@centaurus.parkflow.com`) are obsolete. No other email handler for staff members should exist.
11. **Staff Email Domain Standard:**
    All staff members (`driver`, `washer`, `supervisor`) MUST have their email accounts created under the `@parkflowpk.com` domain. Venue-specific subdomains (e.g., `@centaurus.parkflow.com`) are obsolete. No other email handler for staff members should exist.