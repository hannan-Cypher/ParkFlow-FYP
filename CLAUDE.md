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