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
-- 6. Listings (ported from el-property; supports the admin Listings page)
--    Also kept as a standalone migration:
--    migrations/20261017090000_listings.sql
-- ---------------------------------------------------------------------------

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  title text not null,
  description text,
  rent_amount numeric not null,
  deposit_amount numeric,
  available_from date,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'closed')),
  photos text[] not null default '{}',
  amenities text[] not null default '{}',
  views_count integer not null default 0,
  slug text unique,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_listings_unit_id on listings(unit_id);
create index if not exists idx_listings_status on listings(status);

alter table listings enable row level security;

drop policy if exists "authenticated all" on listings;
create policy "authenticated all" on listings
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_listings_touch on listings;
create trigger trg_listings_touch
  before update on listings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Done. Verify with: select table_name from information_schema.tables
-- where table_schema = 'public' and table_name in
-- ('properties','units','tenants','payments','listings');
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 7. Rental applications, inspections, maintenance, sales & financing,
--    item financing (ported from el-property; five domains).
--    Also kept as a standalone migration: migrations/20261017091000_five_domains.sql
-- ---------------------------------------------------------------------------
-- Five-domain port from el-property: Leases (existing tenants-adapter),
-- Applications, Inspections, Maintenance, Sales & Financing.
-- Backing schema for frontend/src/api/{applications,inspections,maintenance,
-- sales,itemFinancing,financingCategories}.ts and their pages.
-- Safe to re-run (IF NOT EXISTS / DROP IF EXISTS). No secrets. No DROP TABLE.
-- Seed data: financing categories (system defaults) + one penalty rule.
--
-- Deliberately NOT created here (no ported UI yet): customers CRM, loan
-- adjustments/restructuring admin, e-sign templates/signatures, documents,
-- notifications, messages, AI insights, water billing.

-- ===========================================================================
-- 1. Extensions for tenants (buyer/applicant fields — some already added by
--    20261017010000; keep the set complete)
-- ===========================================================================

alter table tenants add column if not exists vendor_name text;
alter table tenants add column if not exists current_address text;

-- ===========================================================================
-- 2. Rental applications (tied to listings; convert → tenants row)
-- ===========================================================================

create table if not exists rental_applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  applicant_name text not null,
  email text not null,
  phone text,
  current_address text,
  employment_status text,
  employer text,
  monthly_income numeric,
  occupants integer,
  desired_move_in date,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'approved', 'rejected', 'withdrawn', 'converted')),
  rejection_reason text,
  reviewed_at timestamptz,
  tenant_id uuid references tenants(id) on delete set null,
  reviewed_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_rental_applications_listing on rental_applications(listing_id);
create index if not exists idx_rental_applications_status on rental_applications(status);

alter table rental_applications enable row level security;
drop policy if exists "authenticated all" on rental_applications;
create policy "authenticated all" on rental_applications
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_rental_applications_touch on rental_applications;
create trigger trg_rental_applications_touch
  before update on rental_applications
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- 3. Inspections (lease_id → tenants id per the lease adapter; move-in/out)
-- ===========================================================================

create table if not exists inspections (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references tenants(id) on delete cascade,
  type text not null check (type in ('move_in', 'move_out')),
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'completed')),
  scheduled_date date,
  completed_at timestamptz,
  overall_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_inspections_lease on inspections(lease_id);

create table if not exists inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  area text not null,
  item text not null,
  condition text check (condition in ('good', 'fair', 'poor', 'damaged')),
  notes text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_inspection_items_inspection on inspection_items(inspection_id);

alter table inspections enable row level security;
drop policy if exists "authenticated all" on inspections;
create policy "authenticated all" on inspections
  for all to authenticated using (true) with check (true);

alter table inspection_items enable row level security;
drop policy if exists "authenticated all" on inspection_items;
create policy "authenticated all" on inspection_items
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_inspections_touch on inspections;
create trigger trg_inspections_touch
  before update on inspections
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_inspection_items_touch on inspection_items;
create trigger trg_inspection_items_touch
  before update on inspection_items
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- 4. Maintenance (workers + tickets). Ticket numbers are generated client-side
--    (`MT-<ts>-<rand4>`, same shape as the source Express route).
-- ===========================================================================

create table if not exists maintenance_workers (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null,
  company_name text,
  contact_person text,
  email text,
  phone text,
  specialty text,
  hourly_rate numeric,
  tax_id text,
  rating numeric default 0,
  total_jobs integer default 0,
  completed_jobs integer default 0,
  active boolean not null default true,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  property_id uuid not null references properties(id),
  unit_id uuid not null references units(id),
  tenant_id uuid references tenants(id),
  description text not null,
  ticket_type text not null default 'general',
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  assigned_worker_id uuid references maintenance_workers(id),
  estimated_cost numeric,
  actual_cost numeric,
  scheduled_date date,
  completion_date date,
  notes text,
  resolution_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_maintenance_tickets_property on maintenance_tickets(property_id);
create index if not exists idx_maintenance_tickets_unit on maintenance_tickets(unit_id);
create index if not exists idx_maintenance_tickets_status on maintenance_tickets(status);
create index if not exists idx_maintenance_tickets_worker on maintenance_tickets(assigned_worker_id);

alter table maintenance_workers enable row level security;
drop policy if exists "authenticated all" on maintenance_workers;
create policy "authenticated all" on maintenance_workers
  for all to authenticated using (true) with check (true);

alter table maintenance_tickets enable row level security;
drop policy if exists "authenticated all" on maintenance_tickets;
create policy "authenticated all" on maintenance_tickets
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_maintenance_workers_touch on maintenance_workers;
create trigger trg_maintenance_workers_touch
  before update on maintenance_workers
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_maintenance_tickets_touch on maintenance_tickets;
create trigger trg_maintenance_tickets_touch
  before update on maintenance_tickets
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- 5. Financing categories (item financing taxonomy, seeded system values)
-- ===========================================================================

create table if not exists financing_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_system boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

alter table financing_categories enable row level security;
drop policy if exists "authenticated all" on financing_categories;
create policy "authenticated all" on financing_categories
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_financing_categories_touch on financing_categories;
create trigger trg_financing_categories_touch
  before update on financing_categories
  for each row execute function public.touch_updated_at();

-- Seed system categories (same six as el-property/server/src/seed-categories.ts).
insert into financing_categories (name, slug, description, is_system)
select v.name, v.slug, v.description, true
from (values
  ('Appliances', 'appliances', 'Air conditioners, Refrigerators, Stoves, etc.'),
  ('Plumbing & Sanitary', 'plumbing___sanitary', 'Water heaters, pumps, pipe replacements'),
  ('Electrical & Lighting', 'electrical___lighting', 'Panel upgrades, smart home installs, wiring'),
  ('Structural & Cosmetic', 'structural___cosmetic', 'Flooring, painting, cabinetry, tiling'),
  ('Security & Safety', 'security___safety', 'CCTV, smart locks, fire alarms, security gates'),
  ('General Improvements', 'general_improvements', 'Other eligible property upgrades')
) as v(name, slug, description)
where not exists (select 1 from financing_categories);

-- ===========================================================================
-- 6. Sales & financing (unit sales, financing applications + schedules,
--    payments with allocation, penalty rules). Buyers live in `tenants`
--    (same as the source: tenant records double as buyers).
-- ===========================================================================

create table if not exists unit_sales (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id),
  buyer_id uuid not null references tenants(id),
  total_contract_price numeric not null,
  reservation_fee numeric,
  reservation_date date,
  reservation_paid boolean not null default false,
  status text not null default 'reserved'
    check (status in ('reserved', 'equity_paying', 'financing_pending', 'financing_approved', 'fully_paid', 'turned_over', 'cancelled')),
  target_turnover_date date,
  turned_over_at timestamptz,
  broker_name text,
  notes text,
  cancelled_at timestamptz,
  cancellation_reason text,
  refund_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_unit_sales_unit on unit_sales(unit_id);
create index if not exists idx_unit_sales_buyer on unit_sales(buyer_id);
create index if not exists idx_unit_sales_status on unit_sales(status);

-- Guard: at most one active (non-terminal) deal per unit.
create unique index if not exists uq_unit_sales_active_unit
  on unit_sales(unit_id)
  where status in ('reserved', 'equity_paying', 'financing_pending', 'financing_approved', 'fully_paid');

create table if not exists financing_applications (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references unit_sales(id) on delete cascade,
  financing_type text not null
    check (financing_type in ('spot_cash', 'deferred_cash', 'in_house_financing', 'bank_financing', 'pagibig_financing')),
  lender_name text,
  loan_amount numeric,
  down_payment_amount numeric,
  down_payment_term_months integer,
  interest_rate_annual numeric(5, 2),
  loan_term_months integer,
  repricing_period_years integer,
  processing_fee numeric,
  mri_premium numeric,
  fire_insurance_premium numeric,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'disapproved', 'cancelled', 'completed')),
  submitted_at timestamptz,
  approved_at timestamptz,
  disapproval_reason text,
  loan_takeout_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create table if not exists amortization_schedules (
  id uuid primary key default gen_random_uuid(),
  financing_application_id uuid not null references financing_applications(id) on delete cascade,
  installment_number integer not null,
  due_date date not null,
  principal_amount numeric not null,
  interest_amount numeric not null,
  amount_due numeric not null,
  running_balance numeric not null,
  status text not null default 'pending'
    check (status in ('pending', 'partial', 'paid')),
  paid_amount numeric,
  paid_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_amortization_schedules_financing
  on amortization_schedules(financing_application_id);

create table if not exists sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references unit_sales(id) on delete cascade,
  amortization_schedule_id uuid references amortization_schedules(id) on delete set null,
  payment_type text not null
    check (payment_type in ('reservation', 'equity', 'amortization', 'penalty', 'refund')),
  amount numeric not null,
  payment_method text not null,
  payment_date date not null,
  reference text,
  notes text,
  allocation_json text,
  or_number text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sale_payments_sale on sale_payments(sale_id);
create index if not exists idx_sale_payments_type on sale_payments(payment_type);

create table if not exists penalty_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  method text not null check (method in ('fixed', 'percent', 'daily', 'monthly')),
  rate numeric(10, 4) not null,
  grace_days integer not null default 0,
  allocation_order text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

-- Seed one standard rule (allocation order = source default) if the table is empty.
insert into penalty_rules (name, method, rate, grace_days, allocation_order, active)
select 'Standard penalty', 'percent', 0.02, 3,
       '["penalty","charges","interest","principal"]', true
where not exists (select 1 from penalty_rules);

alter table unit_sales enable row level security;
drop policy if exists "authenticated all" on unit_sales;
create policy "authenticated all" on unit_sales
  for all to authenticated using (true) with check (true);

alter table financing_applications enable row level security;
drop policy if exists "authenticated all" on financing_applications;
create policy "authenticated all" on financing_applications
  for all to authenticated using (true) with check (true);

alter table amortization_schedules enable row level security;
drop policy if exists "authenticated all" on amortization_schedules;
create policy "authenticated all" on amortization_schedules
  for all to authenticated using (true) with check (true);

alter table sale_payments enable row level security;
drop policy if exists "authenticated all" on sale_payments;
create policy "authenticated all" on sale_payments
  for all to authenticated using (true) with check (true);

alter table penalty_rules enable row level security;
drop policy if exists "authenticated all" on penalty_rules;
create policy "authenticated all" on penalty_rules
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_unit_sales_touch on unit_sales;
create trigger trg_unit_sales_touch
  before update on unit_sales
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_financing_applications_touch on financing_applications;
create trigger trg_financing_applications_touch
  before update on financing_applications
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_amortization_schedules_touch on amortization_schedules;
create trigger trg_amortization_schedules_touch
  before update on amortization_schedules
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_sale_payments_touch on sale_payments;
create trigger trg_sale_payments_touch
  before update on sale_payments
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_penalty_rules_touch on penalty_rules;
create trigger trg_penalty_rules_touch
  before update on penalty_rules
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- 7. Item financing (repairs/appliances/third-category purchases)
-- ===========================================================================

create table if not exists item_financing_requests (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references financing_categories(id),
  requester_id uuid not null references tenants(id),
  unit_id uuid references units(id) on delete set null,
  maintenance_ticket_id uuid references maintenance_tickets(id) on delete set null,
  item_description text not null,
  vendor_name text,
  total_cost numeric not null,
  financing_type text not null
    check (financing_type in ('spot_cash', 'deferred_cash', 'in_house_financing', 'bank_financing')),
  loan_amount numeric,
  down_payment_amount numeric,
  interest_rate_annual numeric(5, 2),
  loan_term_months integer,
  processing_fee numeric,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'disapproved', 'cancelled', 'completed')),
  submitted_at timestamptz,
  approved_at timestamptz,
  disapproval_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_item_financing_requests_category on item_financing_requests(category_id);
create index if not exists idx_item_financing_requests_requester on item_financing_requests(requester_id);
create index if not exists idx_item_financing_requests_status on item_financing_requests(status);

create table if not exists item_amortization_schedules (
  id uuid primary key default gen_random_uuid(),
  item_financing_request_id uuid not null references item_financing_requests(id) on delete cascade,
  installment_number integer not null,
  due_date date not null,
  principal_amount numeric not null,
  interest_amount numeric not null,
  amount_due numeric not null,
  running_balance numeric not null,
  status text not null default 'pending'
    check (status in ('pending', 'partial', 'paid')),
  paid_amount numeric,
  paid_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_item_amortization_schedules_request
  on item_amortization_schedules(item_financing_request_id);

create table if not exists item_financing_payments (
  id uuid primary key default gen_random_uuid(),
  item_financing_request_id uuid not null references item_financing_requests(id) on delete cascade,
  amortization_schedule_id uuid references item_amortization_schedules(id) on delete set null,
  payment_type text not null
    check (payment_type in ('down_payment', 'installment', 'penalty', 'refund')),
  amount numeric not null,
  payment_method text not null,
  payment_date date not null,
  reference text,
  notes text,
  or_number text,
  created_at timestamptz not null default now()
);

create index if not exists idx_item_financing_payments_request
  on item_financing_payments(item_financing_request_id);
create index if not exists idx_item_financing_payments_type
  on item_financing_payments(payment_type);

alter table item_financing_requests enable row level security;
drop policy if exists "authenticated all" on item_financing_requests;
create policy "authenticated all" on item_financing_requests
  for all to authenticated using (true) with check (true);

alter table item_amortization_schedules enable row level security;
drop policy if exists "authenticated all" on item_amortization_schedules;
create policy "authenticated all" on item_amortization_schedules
  for all to authenticated using (true) with check (true);

alter table item_financing_payments enable row level security;
drop policy if exists "authenticated all" on item_financing_payments;
create policy "authenticated all" on item_financing_payments
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_item_financing_requests_touch on item_financing_requests;
create trigger trg_item_financing_requests_touch
  before update on item_financing_requests
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_item_amortization_schedules_touch on item_amortization_schedules;
create trigger trg_item_amortization_schedules_touch
  before update on item_amortization_schedules
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_item_financing_payments_touch on item_financing_payments;
create trigger trg_item_financing_payments_touch
  before update on item_financing_payments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Done. Verify with: select table_name from information_schema.tables
-- where table_schema = 'public' and table_name in
-- ('rental_applications','inspections','inspection_items','maintenance_tickets',
--  'maintenance_workers','financing_categories','unit_sales',
--  'financing_applications','amortization_schedules','sale_payments',
--  'penalty_rules','item_financing_requests','item_amortization_schedules',
--  'item_financing_payments');
-- ---------------------------------------------------------------------------

-- Water billing port from el-property (client-side demo → Supabase).
-- Sourced from frontend/src/pages/WaterTransactionsPage.tsx: water bills
-- (submeter + RUBS) and meter readings, with the el demo rows as seed data.
-- property / unit / tenant are display strings exactly as the source page
-- stores them (free-text in the create modal — no FKs). shortcut: no
-- property_id/unit_id/tenant_id FKs; upgrade when water joins real portfolio
-- entities per-bill.
-- Safe to re-run (IF NOT EXISTS). No secrets. No DROP TABLE.
--
-- Deliberately NOT persisted here (kept client-side as in the source): RUBS
-- calculator inputs and the tariff rate schedule (illustrative tab).

-- ===========================================================================
-- 1. Water bills
-- ===========================================================================

create table if not exists water_bills (
  id uuid primary key,
  bill_number text not null unique,
  property text not null,
  unit text not null,
  tenant text not null,
  method text not null check (method in ('submeter', 'rubs')),
  previous_reading numeric,
  current_reading numeric,
  consumption numeric,
  rubs_factor text,
  rate_per_unit numeric not null default 0,
  base_charge numeric not null default 0,
  sewer_fee numeric not null default 0,
  total_amount numeric not null,
  billing_period text not null,
  due_date date not null,
  status text not null default 'pending'
    check (status in ('paid', 'pending', 'overdue')),
  payment_date date,
  payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_water_bills_status on water_bills(status);
create index if not exists idx_water_bills_billing_period on water_bills(billing_period);

alter table water_bills enable row level security;
drop policy if exists "authenticated all" on water_bills;
create policy "authenticated all" on water_bills
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_water_bills_touch on water_bills;
create trigger trg_water_bills_touch
  before update on water_bills
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- 2. Meter readings (submeter log; leak flag from the source's >30 m³ rule)
-- ===========================================================================

create table if not exists water_readings (
  id uuid primary key,
  meter_id text not null,
  property text not null,
  unit text not null,
  tenant text not null,
  previous_reading numeric not null,
  current_reading numeric not null,
  consumption numeric not null,
  reading_date date not null,
  reader_name text not null,
  leak_warning boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_water_readings_reading_date on water_readings(reading_date desc);

alter table water_readings enable row level security;
drop policy if exists "authenticated all" on water_readings;
create policy "authenticated all" on water_readings
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_water_readings_touch on water_readings;
create trigger trg_water_readings_touch
  before update on water_readings
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- 3. Seed: the el WaterTransactionsPage INITIAL_BILLS / INITIAL_READINGS rows
--    (fixed ids so this stays idempotent; updated_at = created_at)
-- ===========================================================================

insert into water_bills (id, bill_number, property, unit, tenant, method,
  previous_reading, current_reading, consumption, rubs_factor,
  rate_per_unit, base_charge, sewer_fee, total_amount, billing_period,
  due_date, status, payment_date, payment_method, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', 'WB-2026-1001', 'Casa Verde Residences', 'Unit 304', 'Alexander Wright', 'submeter',
    124.5, 138.2, 13.7, null, 2.85, 15.0, 8.5, 62.55, 'Oct 2026',
    '2026-10-25', 'paid', '2026-10-08', 'Credit Card', now(), now()),
  ('00000000-0000-4000-8000-000000000002', 'WB-2026-1002', 'Casa Verde Residences', 'Unit 412', 'Elena Rostova', 'submeter',
    210.0, 231.8, 21.8, null, 2.85, 15.0, 12.5, 89.63, 'Oct 2026',
    '2026-10-25', 'pending', null, null, now(), now()),
  ('00000000-0000-4000-8000-000000000003', 'WB-2026-1003', 'Salcedo Park Tower', 'Unit 102', 'Marcus Vance', 'rubs',
    null, null, null, '3 Occupants (14.2% ratio)', 0, 0, 14.0, 76.4, 'Oct 2026',
    '2026-10-20', 'overdue', null, null, now(), now()),
  ('00000000-0000-4000-8000-000000000004', 'WB-2026-1004', 'Salcedo Park Tower', 'Unit 205', 'Sarah Jenkins', 'rubs',
    null, null, null, '1 Occupant (6.5% ratio)', 0, 0, 7.2, 38.2, 'Oct 2026',
    '2026-10-25', 'paid', '2026-10-10', 'Bank Transfer', now(), now()),
  ('00000000-0000-4000-8000-000000000005', 'WB-2026-1005', 'Mactan Breeze Apartments', 'Unit 11B', 'David Chen', 'submeter',
    340.2, 372.6, 32.4, null, 2.85, 15.0, 18.2, 125.54, 'Oct 2026',
    '2026-10-25', 'pending', null, null, now(), now())
on conflict (id) do nothing;

insert into water_readings (id, meter_id, property, unit, tenant,
  previous_reading, current_reading, consumption, reading_date, reader_name,
  leak_warning, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000101', 'WM-CV-304', 'Casa Verde Residences', 'Unit 304', 'Alexander Wright',
    124.5, 138.2, 13.7, '2026-10-01', 'Property Staff', false, now(), now()),
  ('00000000-0000-4000-8000-000000000102', 'WM-CV-412', 'Casa Verde Residences', 'Unit 412', 'Elena Rostova',
    210.0, 231.8, 21.8, '2026-10-01', 'Property Staff', false, now(), now()),
  ('00000000-0000-4000-8000-000000000103', 'WM-MB-11B', 'Mactan Breeze Apartments', 'Unit 11B', 'David Chen',
    340.2, 372.6, 32.4, '2026-10-02', 'IoT Smart Meter', true, now(), now())
on conflict (id) do nothing;

-- Approvals + Staff & Admins port from el-property, with tenant-scoped RLS.
-- From el client pages/pages: ApprovalsPage (pending tenant signups) and
-- UsersPage (staff accounts, role editing) over the el /auth/* REST routes.
--
-- What changes tenant visibility:
--   * new `users` table = login accounts + signup requests (role set:
--     admin/manager/staff/contractor/tenant/pending; pending = tenant signup).
--   * signal helpers is_staff() (admin/manager/staff/contractor, verified);
--     a tenant auth user is anything signed in that is not staff.
--   * tenants.auth_user_id links the existing lease table to the auth user;
--     existing rows auto-link by email when a verified tenant user matches.
--   * every domain table keeps its old DB/row data but SELCTs (read) are
--     limited to staff or that tenant's own rows. Writes stay staff-only.
--     The open "authenticated all" policies from earlier migrations are
--     replaced (dropped) — that is the point of this migration.
--   * portfolio tables (properties/units/listings/financing_categories) stay
--     readable by all signed-in users; writes become staff-only.
-- Safe to re-run. No secrets. No DROP TABLE.
-- shortcut: no tenant self-registration page is ported (el pages/tenant/* not
-- in scope), so new pending-signup rows enter via the admin flows here;
-- SUPABASE AUTH trigger seeds every new auth user as role='pending'.
-- shortcut: water_bills/water_readings keep the free-text tenant column from
-- the demo port; a new nullable tenant_id adds precise scoping, with a
-- text-name fallback so legacy rows are still visible to their tenant.

-- ===========================================================================
-- 1. users table (login accounts + signup requests) — from el users model
--    (created BEFORE is_staff(): SQL-function bodies are validated at CREATE
--    FUNCTION time, so every referenced table must already exist)
-- ===========================================================================

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'pending'
    check (role in ('admin', 'manager', 'staff', 'contractor', 'tenant', 'pending')),
  verified boolean not null default false,
  phone text,
  company_name text,
  employment_status text,
  monthly_income numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_users_auth_user on users(auth_user_id);
create index if not exists idx_users_role on users(role);
create index if not exists idx_users_email on users(email);

alter table users enable row level security;

-- Role helper (security definer so policy sub-queries can't recurse via RLS).
-- Created after the table it reads, before the policies that call it.
create or replace function public.is_staff() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.users
    where auth_user_id = auth.uid()
      and verified
      and role in ('admin', 'manager', 'staff', 'contractor')
  );
$$;

drop policy if exists "staff all" on users;
create policy "staff all" on users
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "self select" on users;
create policy "self select" on users
  for select to authenticated using (auth_user_id = auth.uid());
drop policy if exists "self signup pending" on users;
create policy "self signup pending" on users
  for insert to authenticated
  with check (auth_user_id = auth.uid() and role = 'pending');

drop trigger if exists trg_users_touch on users;
create trigger trg_users_touch
  before update on users
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- 3. Auto-seed a users row for every new auth signup (role 'pending')
--    and backfill rows for existing auth users as verified staff-admins.
--    (Single-operator project: anyone already in auth.users is an operator.)
-- ===========================================================================

create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (auth_user_id, name, email, role, verified)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'User'),
    new.email,
    'pending',
    false
  )
  on conflict (auth_user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into users (auth_user_id, name, email, role, verified, created_at, updated_at)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1), 'User'),
       u.email, 'admin', true, coalesce(u.created_at, now()), now()
from auth.users u
on conflict (auth_user_id) do nothing;

-- ===========================================================================
-- 4. Link tenants (the lease table) to auth accounts, then scope everything
-- ===========================================================================

alter table tenants add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;
create index if not exists idx_tenants_auth_user on tenants(auth_user_id);

update tenants
set auth_user_id = (
  select usr.id from users usr
  where lower(usr.email) = lower(tenants.email)
    and usr.role in ('tenant', 'pending')
    and usr.auth_user_id is not null
  limit 1
)
where auth_user_id is null and email is not null;

-- ===========================================================================
-- 4b. Helper conditions, then per-table policies (staff gets everything;
--     tenant auth users read only their own rows)
-- ===========================================================================

-- 4b.1 tenants — direct link
drop policy if exists "staff all" on tenants;
create policy "staff all" on tenants
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on tenants;
create policy "tenant read own" on tenants
  for select to authenticated using (auth_user_id = auth.uid());

-- 4b.2 one-hop tables (tenant_id / buyer_id / lease_id → tenants)
-- rental_applications, maintenance_tickets, unit_sales
drop policy if exists "authenticated all" on rental_applications;
drop policy if exists "staff all" on rental_applications;
create policy "staff all" on rental_applications
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on rental_applications;
create policy "tenant read own" on rental_applications
  for select to authenticated using (
    exists (select 1 from tenants t where t.id = rental_applications.tenant_id and t.auth_user_id = auth.uid())
  );

drop policy if exists "authenticated all" on maintenance_tickets;
drop policy if exists "staff all" on maintenance_tickets;
create policy "staff all" on maintenance_tickets
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on maintenance_tickets;
create policy "tenant read own" on maintenance_tickets
  for select to authenticated using (
    exists (select 1 from tenants t where t.id = maintenance_tickets.tenant_id and t.auth_user_id = auth.uid())
  );

drop policy if exists "authenticated all" on unit_sales;
drop policy if exists "staff all" on unit_sales;
create policy "staff all" on unit_sales
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on unit_sales;
create policy "tenant read own" on unit_sales
  for select to authenticated using (
    exists (select 1 from tenants t where t.id = unit_sales.buyer_id and t.auth_user_id = auth.uid())
  );

-- inspections (+items) via lease_id
drop policy if exists "authenticated all" on inspections;
drop policy if exists "staff all" on inspections;
create policy "staff all" on inspections
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on inspections;
create policy "tenant read own" on inspections
  for select to authenticated using (
    exists (
      select 1 from tenants t
      where t.id = inspections.lease_id and t.auth_user_id = auth.uid()
    )
  );

drop policy if exists "authenticated all" on inspection_items;
drop policy if exists "staff all" on inspection_items;
create policy "staff all" on inspection_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on inspection_items;
create policy "tenant read own" on inspection_items
  for select to authenticated using (
    exists (
      select 1 from inspections i join tenants t on t.id = i.lease_id
      where i.id = inspection_items.inspection_id and t.auth_user_id = auth.uid()
    )
  );

-- financing_applications / amortization_schedules / sale_payments via sale → buyer
drop policy if exists "authenticated all" on financing_applications;
drop policy if exists "staff all" on financing_applications;
create policy "staff all" on financing_applications
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on financing_applications;
create policy "tenant read own" on financing_applications
  for select to authenticated using (
    exists (
      select 1 from unit_sales s join tenants t on t.id = s.buyer_id
      where s.id = financing_applications.sale_id and t.auth_user_id = auth.uid()
    )
  );

drop policy if exists "authenticated all" on amortization_schedules;
drop policy if exists "staff all" on amortization_schedules;
create policy "staff all" on amortization_schedules
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on amortization_schedules;
create policy "tenant read own" on amortization_schedules
  for select to authenticated using (
    exists (
      select 1 from financing_applications a
      join unit_sales s on s.id = a.sale_id
      join tenants t on t.id = s.buyer_id
      where a.id = amortization_schedules.financing_application_id and t.auth_user_id = auth.uid()
    )
  );

drop policy if exists "authenticated all" on sale_payments;
drop policy if exists "staff all" on sale_payments;
create policy "staff all" on sale_payments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on sale_payments;
create policy "tenant read own" on sale_payments
  for select to authenticated using (
    exists (
      select 1 from unit_sales s join tenants t on t.id = s.buyer_id
      where s.id = sale_payments.sale_id and t.auth_user_id = auth.uid()
    )
  );

-- item financing: requester_id is a tenants id
drop policy if exists "authenticated all" on item_financing_requests;
drop policy if exists "staff all" on item_financing_requests;
create policy "staff all" on item_financing_requests
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on item_financing_requests;
create policy "tenant read own" on item_financing_requests
  for select to authenticated using (
    exists (select 1 from tenants t where t.id = item_financing_requests.requester_id and t.auth_user_id = auth.uid())
  );

drop policy if exists "authenticated all" on item_amortization_schedules;
drop policy if exists "staff all" on item_amortization_schedules;
create policy "staff all" on item_amortization_schedules
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on item_amortization_schedules;
create policy "tenant read own" on item_amortization_schedules
  for select to authenticated using (
    exists (
      select 1 from item_financing_requests ir join tenants t on t.id = ir.requester_id
      where ir.id = item_amortization_schedules.item_financing_request_id and t.auth_user_id = auth.uid()
    )
  );

drop policy if exists "authenticated all" on item_financing_payments;
drop policy if exists "staff all" on item_financing_payments;
create policy "staff all" on item_financing_payments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on item_financing_payments;
create policy "tenant read own" on item_financing_payments
  for select to authenticated using (
    exists (
      select 1 from item_financing_requests ir join tenants t on t.id = ir.requester_id
      where ir.id = item_financing_payments.item_financing_request_id and t.auth_user_id = auth.uid()
    )
  );

-- pre-existing payments table (billing) — tenant_id linkage
drop policy if exists "authenticated all" on payments;
drop policy if exists "staff all" on payments;
create policy "staff all" on payments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on payments;
create policy "tenant read own" on payments
  for select to authenticated using (
    exists (select 1 from tenants t where t.id = payments.tenant_id and t.auth_user_id = auth.uid())
  );

-- water: add tenant_id, scope by id or the demo text name fallback
alter table water_bills add column if not exists tenant_id uuid references tenants(id) on delete set null;
create index if not exists idx_water_bills_tenant on water_bills(tenant_id);
alter table water_readings add column if not exists tenant_id uuid references tenants(id) on delete set null;
create index if not exists idx_water_readings_tenant on water_readings(tenant_id);

drop policy if exists "authenticated all" on water_bills;
drop policy if exists "staff all" on water_bills;
create policy "staff all" on water_bills
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on water_bills;
create policy "tenant read own" on water_bills
  for select to authenticated using (
    tenant_id in (select id from tenants where auth_user_id = auth.uid())
    or tenant = (select t.full_name from tenants t where t.auth_user_id = auth.uid() limit 1)
  );

drop policy if exists "authenticated all" on water_readings;
drop policy if exists "staff all" on water_readings;
create policy "staff all" on water_readings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "tenant read own" on water_readings;
create policy "tenant read own" on water_readings
  for select to authenticated using (
    tenant_id in (select id from tenants where auth_user_id = auth.uid())
    or tenant = (select t.full_name from tenants t where t.auth_user_id = auth.uid() limit 1)
  );

-- portfolio/reference: readable by all signed-in users, writable by staff
drop policy if exists "authenticated all" on properties;
drop policy if exists "staff all" on properties;
create policy "staff all" on properties
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "authenticated select" on properties;
create policy "authenticated select" on properties
  for select to authenticated using (true);

drop policy if exists "authenticated all" on units;
drop policy if exists "staff all" on units;
create policy "staff all" on units
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "authenticated select" on units;
create policy "authenticated select" on units
  for select to authenticated using (true);

drop policy if exists "authenticated all" on listings;
drop policy if exists "staff all" on listings;
create policy "staff all" on listings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "authenticated select" on listings;
create policy "authenticated select" on listings
  for select to authenticated using (true);

drop policy if exists "authenticated all" on financing_categories;
drop policy if exists "staff all" on financing_categories;
create policy "staff all" on financing_categories
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "authenticated select" on financing_categories;
create policy "authenticated select" on financing_categories
  for select to authenticated using (true);

-- staff-only admin/reference tables
drop policy if exists "authenticated all" on maintenance_workers;
drop policy if exists "staff all" on maintenance_workers;
create policy "staff all" on maintenance_workers
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "authenticated all" on penalty_rules;
drop policy if exists "staff all" on penalty_rules;
create policy "staff all" on penalty_rules
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
