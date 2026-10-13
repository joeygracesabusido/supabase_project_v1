# Real Property Management Dashboard — Design

Date: 2026-10-13
Approach: Lean Sidebar + CSS-only visuals, Direct Supabase (approved)
Scope: A (Landlord overview) + B (Property/Unit CRUD) + C-simple (due vs paid + landlord ledger, no double-entry)

## Problem
After login (`frontend/src/App.tsx` shows `Signed in as...`), there is no usable dashboard. User needs overview (occupancy, rent), CRUD for properties/units/tenants, and simple payments ledger. Existing `supabase_units.sql` has `units` referencing missing `properties`. `backend/main.py` GraphQL is unused — frontend uses direct Supabase.

## Constraints / decisions
- Direct Supabase from frontend only (no backend changes). Fastest, matches current `App.tsx`.
- No new runtime deps (no react-router, no recharts). Tabs via `useState`. CSS bars via Tailwind.
- Keep dark glass style + Tailwind v4. Reuse `TiltCard` only for auth, not dashboard.
- TypeScript throughout. RLS enabled (standard practice).
- YAGNI: no routing URLs, no chart lib, no GAAP double-entry, no multi-role, no PDF receipts.

## Architecture
`App.tsx` becomes auth-gated shell:
- No session → existing `AuthForm` (TiltCard glass) unchanged.
- Session (`supabase.auth.getSession()` + `onAuthStateChange`) → `DashboardShell` (sidebar + tab content).
- Tabs: `overview | properties | units | payments` via `useState`. Each tab isolated so adding `react-router` later = 1-file change.
- Data hooks in `lib/useDashboard.ts`: `useProperties, useUnits, useTenants, usePayments` using `supabase.from().select()`. KPIs computed client-side.

## Schema (extends existing `units`)
Keep existing `units(id, property_id→properties.id, unit_number, rent, status vacant|occupied, created_at, unique(property_id, unit_number))`.

New:
- `properties(id uuid pk default gen_random_uuid(), name text not null, address text not null, created_at timestamptz default now())`
- `tenants(id uuid pk default gen_random_uuid(), full_name text not null, email text, unit_id uuid references units(id) on delete set null, lease_start date, lease_end date, created_at timestamptz default now())`
- `payments(id uuid pk default gen_random_uuid(), tenant_id uuid references tenants(id) on delete cascade, unit_id uuid references units(id) on delete cascade, amount numeric not null check (amount > 0), method text check (method in ('cash','gcash','bank','other')), for_month date not null (always first day of month, e.g. 2026-10-01), paid_on date default CURRENT_DATE, note text, created_at timestamptz default now())`
- Indexes: `idx_units_property_id` (exists), `idx_tenants_unit_id`, `idx_payments_for_month`, `idx_payments_unit_id`.
- RLS: enable on all 4; v1 single-landlord policy `authenticated can all` (add `owner_id = auth.uid()` later).

KPIs (Overview):
- occupancy % = occupied / total units
- expected rent = sum(units.rent)
- collected (selected month) = sum(payments.amount where for_month = month)
- vacant count + collection rate = collected / expected

## Components
1. `App.tsx` — shell + session gate + sign-out.
2. `components/DashboardShell.tsx` — sidebar nav + content area. Mobile: top tabs. One job: layout + tab state.
3. `components/KpiCard.tsx` — label, value, sub.
4. `components/Overview.tsx` — 4x KpiCard + occupancy bar (`div width %`) + last 5 payments.
5. `components/Properties.tsx` — table + add/edit modal (name, address) + delete confirm.
6. `components/Units.tsx` — property filter dropdown + table (unit_number, rent, status toggle).
7. `components/Payments.tsx` — month filter + ledger table + record-payment form (tenant, unit, amount, method, for_month). Balance per unit = rent - paid that month.
8. `lib/useDashboard.ts` — typed hooks, one query per tab.

## Data flow
Tab mount → hook `select()` → render → CRUD via `insert/update/delete` → refetch. Payment write validates `amount > 0` client + check constraint. No backend, no cache lib.

## Error handling
Per-tab loading skeleton, `error.message` alert, empty states ("No properties yet — add one"). Disable submit while saving. RLS errors surface, not silent.

## Testing
- Keep auth render + toggle tests.
- Add: Overview renders 4 KPIs; tab switch works; record-payment rejects amount <= 0.
- `npm run typecheck` + `npm run build` + `vitest run` must pass. No new test deps.

## Files touched
- `supabase_units.sql` → extend or new `supabase_properties_dashboard.sql` (properties/tenants/payments + RLS + indexes).
- `frontend/src/App.tsx` — shell gate.
- `frontend/src/components/DashboardShell.tsx` (new), `KpiCard.tsx` (new), `Overview.tsx` (new), `Properties.tsx` (new), `Units.tsx` (new), `Payments.tsx` (new).
- `frontend/src/lib/useDashboard.ts` (new).
- `frontend/src/App.test.tsx` — add 3 tests above.

## Out of scope
Routing, Recharts, GAAP double-entry/chart of accounts, multi-landlord roles, receipt PDF, pagination beyond filter, backend GraphQL changes.
