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
