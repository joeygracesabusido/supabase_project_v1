create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  unit_number text not null,
  rent numeric not null default 0,
  status text not null default 'vacant' check (status in ('vacant', 'occupied')),
  created_at timestamptz default now(),
  unique(property_id, unit_number)
);

create index if not exists idx_units_property_id on units(property_id);

-- Full unit model (mirrors el-property Prisma `units` minus
-- system-managed active/features). IF NOT EXISTS so re-running upgrades
-- databases created before these columns existed. `rent` is kept (do not
-- rename: KPIs and existing rows depend on it) as the equivalent of
-- el-property's `rental_price`.
alter table units add column if not exists floor_area numeric;
alter table units add column if not exists floor_number integer;
alter table units add column if not exists bedroom_count integer;
alter table units add column if not exists bathroom_count integer;
alter table units add column if not exists unit_type text;
alter table units add column if not exists phase text;
alter table units add column if not exists block text;
alter table units add column if not exists lot text;
alter table units add column if not exists description text;
