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
