-- El-property frontend migration: supporting schema for the ported UI.
--
-- Scope: the migrated frontend (Tenants tab, search/filter/sort/pagination on
-- Properties/Units/Payments, shared UI primitives) runs entirely on the four
-- existing tables: properties, units, tenants, payments. This migration adds
-- ONLY what those features need and is safe to re-run (all statements are
-- IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE):
--
--   1. updated_at columns + auto-touch trigger (edit dialogs in Properties,
--      Units, Tenants now mutate rows; modification timestamps are standard
--      for those workflows).
--   2. Search/filter indexes backing the new client-side search inputs and
--      the Payments filtration panel (tenant/unit/month/method).
--   3. Re-asserted RLS + authenticated policies (same model as the existing
--      migrations: authenticated role has full access, nothing public).
--
-- What this file deliberately does NOT create: leases, maintenance tickets,
-- listings/applications, inspections, sales/financing ledgers, notifications,
-- messages, documents. Those el-property domains are backed by an
-- Express + MySQL/Prisma API that was NOT ported (target keeps its Supabase
-- backend), so creating their tables without the corresponding UI would be
-- dead schema. Add them in a follow-up migration together with their UI.
--
-- No seed data. No secrets. No DROP TABLE. Review then apply, e.g.:
--   supabase db push
-- or paste into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. Modification timestamps
-- ---------------------------------------------------------------------------

alter table properties add column if not exists updated_at timestamptz default now();
alter table units      add column if not exists updated_at timestamptz default now();
alter table tenants    add column if not exists updated_at timestamptz default now();
alter table payments   add column if not exists updated_at timestamptz default now();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_properties_touch on properties;
create trigger trg_properties_touch
  before update on properties
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_units_touch on units;
create trigger trg_units_touch
  before update on units
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_tenants_touch on tenants;
create trigger trg_tenants_touch
  before update on tenants
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_payments_touch on payments;
create trigger trg_payments_touch
  before update on payments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Search / filter indexes for the migrated list UIs
-- ---------------------------------------------------------------------------

-- Properties search input (name / address / city).
create index if not exists idx_properties_name_trgm on properties (name);
create index if not exists idx_properties_city on properties (city);

-- Units search input (unit_number) + status filter + property filter.
create index if not exists idx_units_unit_number on units (unit_number);
create index if not exists idx_units_status on units (status);

-- Tenants search input (full_name / email) + unit assignment lookup.
create index if not exists idx_tenants_full_name on tenants (full_name);
create index if not exists idx_tenants_email on tenants (email);

-- Payments filtration panel (method + month) + tenant/unit name search.
-- idx_payments_for_month / idx_payments_unit_id already exist; keep them.
create index if not exists idx_payments_method on payments (method);
create index if not exists idx_payments_tenant_id on payments (tenant_id);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security (same model as existing migrations)
-- ---------------------------------------------------------------------------

alter table properties enable row level security;
alter table units      enable row level security;
alter table tenants    enable row level security;
alter table payments   enable row level security;

drop policy if exists "authenticated all" on properties;
create policy "authenticated all" on properties
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all" on units;
create policy "authenticated all" on units
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all" on tenants;
create policy "authenticated all" on tenants
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all" on payments;
create policy "authenticated all" on payments
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Assumptions / conflicts (for the reviewer)
-- ---------------------------------------------------------------------------
-- A1. Existing RLS uses a single permissive authenticated-only policy per
--     table. This file re-asserts that model instead of inventing per-role
--     policies, because the target has no roles column / auth-claims mapping
--     (el-property's admin/manager/staff/tenant roles live in its MySQL
--     `users` table, which was not ported). If role-aware RLS is needed,
--     add a profiles/roles table first, then tighten these policies.
-- A2. `units.rent` is kept as-is (existing KPIs depend on it); it is the
--     equivalent of el-property's `rental_price`. No rename.
-- A3. Currency display stays in USD ($) to match existing target UI; the
--     ported `formatCurrency` helper defaults to en-US. Switch the helper
--     (one line in frontend/src/lib/format.ts) if the business bills in PHP.
-- A4. No pg_trgm extension is enabled here; the LIKE-based client search
--     works without it. Enable pg_trgm + GIN indexes later if portfolio
--     size makes prefix search slow.
