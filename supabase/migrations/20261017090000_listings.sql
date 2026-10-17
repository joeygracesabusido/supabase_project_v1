-- Listings domain ported from el-property (admin Listings page).
-- Backing table for frontend/src/api/listings.ts + pages/ListingsPage.tsx.
-- No public /browse pages here yet, so RLS stays authenticated-only (same model
-- as properties/units/tenants/payments). Safe to re-run (IF NOT EXISTS / DROP
-- IF EXISTS). No seed data. No secrets. No DROP TABLE.
--
-- NOTE: el-property also had rental_applications tied to listings; no
-- applications UI was ported, so no applications table here. Add one in a
-- follow-up migration together with its UI.

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

-- ---------------------------------------------------------------------------
-- Row Level Security (same model as existing migrations)
-- ---------------------------------------------------------------------------

alter table listings enable row level security;

drop policy if exists "authenticated all" on listings;
create policy "authenticated all" on listings
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- updated_at auto-touch (same trigger as the other tables)
-- ---------------------------------------------------------------------------

drop trigger if exists trg_listings_touch on listings;
create trigger trg_listings_touch
  before update on listings
  for each row execute function public.touch_updated_at();
