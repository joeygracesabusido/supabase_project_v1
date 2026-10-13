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
