create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  created_at timestamptz default now()
);

-- Full property model (mirrors el-property Prisma `properties` minus
-- system-managed latitude/longitude/active). IF NOT EXISTS so re-running
-- upgrades databases created before these columns existed.
alter table properties add column if not exists city text;
alter table properties add column if not exists state text;
alter table properties add column if not exists zip text;
alter table properties add column if not exists total_units integer default 0;
alter table properties add column if not exists asset_category text;
alter table properties add column if not exists description text;
alter table properties add column if not exists building_type text;
alter table properties add column if not exists year_built integer;

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

create index if not exists idx_tenants_unit_id on tenants(unit_id);
create index if not exists idx_payments_for_month on payments(for_month);
create index if not exists idx_payments_unit_id on payments(unit_id);

alter table properties enable row level security;
alter table tenants enable row level security;
alter table payments enable row level security;
alter table units enable row level security;

drop policy if exists "authenticated all" on properties;
create policy "authenticated all" on properties for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all" on tenants;
create policy "authenticated all" on tenants for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all" on payments;
create policy "authenticated all" on payments for all to authenticated using (true) with check (true);
drop policy if exists "authenticated all" on units;
create policy "authenticated all" on units for all to authenticated using (true) with check (true);
