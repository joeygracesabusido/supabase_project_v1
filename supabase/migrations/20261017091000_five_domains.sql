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
