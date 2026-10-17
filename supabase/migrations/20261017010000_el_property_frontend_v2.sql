-- El-property frontend v2: columns the ported Properties/Units/Tenants/Billing
-- UI writes that the v1 schema lacks. Safe to re-run (IF NOT EXISTS only).
-- No seed data. RLS unchanged (authenticated-only policies already exist).

-- 1. Properties: active flag (card accent bar + badge + bulk delete UI)
alter table properties add column if not exists active boolean not null default true;

-- 2. Tenants: el-property tenant detail fields used by Add/EditTenantModal
alter table tenants add column if not exists phone text;
alter table tenants add column if not exists company_name text;
alter table tenants add column if not exists employment_status text;
alter table tenants add column if not exists employer text;
alter table tenants add column if not exists monthly_income numeric;
alter table tenants add column if not exists notes text;
alter table tenants add column if not exists active boolean not null default true;
-- Assignment deposit (el-property "deposit_amount" on lease creation)
alter table tenants add column if not exists deposit numeric;

-- 3. Units: widen status to the source's 4-state model
alter table units drop constraint if exists units_status_check;
alter table units add constraint units_status_check
  check (status in ('vacant', 'occupied', 'maintenance', 'reserved'));

-- 4. Search/filter support for the ported UI
create index if not exists idx_tenants_phone on tenants (phone);
create index if not exists idx_tenants_active on tenants (active);
