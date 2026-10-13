-- ===========================================================================
-- Property Manager — full database setup (paste-ready for Supabase SQL editor)
-- ===========================================================================
-- HOW TO APPLY:
--   1. Open https://supabase.com/dashboard/project/fdwjwwcuaazzwkqcnqvs
--   2. Left sidebar -> SQL Editor -> New query
--   3. Paste this ENTIRE file, press Run (or Cmd/Ctrl + Enter)
--
-- SAFE TO RE-RUN: every statement is IF NOT EXISTS / DROP IF EXISTS /
-- CREATE OR REPLACE. It only adds missing objects; it never deletes data,
-- never drops tables, contains no seed data and no secrets.
--
-- WHAT IT CREATES (in dependency order):
--   properties -> units -> tenants -> payments, then extra columns,
--   updated_at auto-touch triggers, search/filter indexes, and RLS policies
--   (authenticated users have full access; nothing is public).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables (parents before children so foreign keys resolve)
-- ---------------------------------------------------------------------------

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  created_at timestamptz default now()
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  unit_number text not null,
  rent numeric not null default 0,
  status text not null default 'vacant' check (status in ('vacant', 'occupied')),
  created_at timestamptz default now(),
  unique(property_id, unit_number)
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  unit_id uuid references units(id) on delete set null,
  lease_start date,
  lease_end date,
  created_at timestamptz default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  unit_id uuid references units(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text check (method in ('cash','gcash','bank','other')),
  for_month date not null,
  paid_on date default CURRENT_DATE,
  note text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 2. Extended columns (full property / unit model; skipped if already added)
-- ---------------------------------------------------------------------------

alter table properties add column if not exists city text;
alter table properties add column if not exists state text;
alter table properties add column if not exists zip text;
alter table properties add column if not exists total_units integer default 0;
alter table properties add column if not exists asset_category text;
alter table properties add column if not exists description text;
alter table properties add column if not exists building_type text;
alter table properties add column if not exists year_built integer;

alter table units add column if not exists floor_area numeric;
alter table units add column if not exists floor_number integer;
alter table units add column if not exists bedroom_count integer;
alter table units add column if not exists bathroom_count integer;
alter table units add column if not exists unit_type text;
alter table units add column if not exists phase text;
alter table units add column if not exists block text;
alter table units add column if not exists lot text;
alter table units add column if not exists description text;

-- ---------------------------------------------------------------------------
-- 3. Modification timestamps + auto-touch trigger
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
-- 4. Indexes (relationships + search/filter inputs in the UI)
-- ---------------------------------------------------------------------------

create index if not exists idx_units_property_id on units(property_id);
create index if not exists idx_tenants_unit_id on tenants(unit_id);
create index if not exists idx_payments_for_month on payments(for_month);
create index if not exists idx_payments_unit_id on payments(unit_id);

-- Search boxes / filter dropdowns added with the el-property UI migration.
create index if not exists idx_properties_name_trgm on properties (name);
create index if not exists idx_properties_city on properties (city);
create index if not exists idx_units_unit_number on units (unit_number);
create index if not exists idx_units_status on units (status);
create index if not exists idx_tenants_full_name on tenants (full_name);
create index if not exists idx_tenants_email on tenants (email);
create index if not exists idx_payments_method on payments (method);
create index if not exists idx_payments_tenant_id on payments (tenant_id);

-- ---------------------------------------------------------------------------
-- 5. Row Level Security (authenticated app users only; nothing public)
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
-- Done. Verify with: select table_name from information_schema.tables
-- where table_schema = 'public' and table_name in
-- ('properties','units','tenants','payments');
-- ---------------------------------------------------------------------------
