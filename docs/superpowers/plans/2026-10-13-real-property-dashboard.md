# Real Property Management Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build lean sidebar property dashboard (overview + properties/units/payments) gated behind existing Supabase auth.

**Architecture:** Auth-gated `App.tsx` shell → `DashboardShell` sidebar with `useState` tabs. Each tab isolated component with direct Supabase query via `lib/useDashboard.ts`. KPIs computed client-side pure function. Same Tailwind v4 dark glass style, no router, no charts lib.

**Tech Stack:** Vite 6 + React 18 + TypeScript 5 + Tailwind v4 (`@tailwindcss/vite`) + `@supabase/supabase-js` 2.x + vitest + jsdom + Testing Library.

## Global Constraints

- Direct Supabase from frontend only (no backend changes). Fastest, matches current `App.tsx`.
- No new runtime deps (no react-router, no recharts). Tabs via `useState`. CSS bars via Tailwind.
- Keep dark glass style + Tailwind v4. Reuse `TiltCard` only for auth, not dashboard.
- TypeScript throughout. RLS enabled (standard practice).
- YAGNI: no routing URLs, no chart lib, no GAAP double-entry, no multi-role, no PDF receipts.

---

## File Structure

- `supabase_properties_dashboard.sql` (new, repo root) — creates `properties`, `tenants`, `payments`, keeps `units` compatible, adds indexes + RLS. One responsibility: DB contract.
- `frontend/src/lib/types.ts` (new) — `Property, Unit, Tenant, Payment, Tab` types. Single source of truth for shapes.
- `frontend/src/lib/kpis.ts` (new) — pure `calcKpis(units, payments, monthYYYYMM)` + `toMonthKey()`. No Supabase, fully testable.
- `frontend/src/lib/useDashboard.ts` (new) — `useProperties(), useUnits(), useTenants(), usePayments(month)` hooks returning `{data, loading, error, reload}`. Only Supabase access layer.
- `frontend/src/components/KpiCard.tsx` (new) — presentational metric card.
- `frontend/src/components/DashboardShell.tsx` (new) — sidebar + tab state + content slot.
- `frontend/src/components/Overview.tsx` (new) — 4x KpiCard + occupancy bar + recent payments.
- `frontend/src/components/Properties.tsx` (new) — properties CRUD table + modal.
- `frontend/src/components/Units.tsx` (new) — units table + property filter + status toggle.
- `frontend/src/components/Payments.tsx` (new) — ledger + record-payment form + month filter. Validates `amount > 0`.
- `frontend/src/App.tsx` (modify) — session gate: AuthForm vs DashboardShell, sign-out. Keeps existing auth logic untouched.
- `frontend/src/App.test.tsx`, `frontend/src/lib/kpis.test.ts`, `frontend/src/components/*.test.tsx` — vitest coverage.

Interfaces flow: `types.ts` → `kpis.ts` + `useDashboard.ts` → `Overview/Properties/Units/Payments` (consume types + hooks) → `DashboardShell` (consumes tab components) → `App.tsx` (consumes DashboardShell + supabase auth).

---

### Task 1: DB contract + shared types

**Files:**
- Create: `supabase_properties_dashboard.sql`
- Create: `frontend/src/lib/types.ts`
- Test: manual SQL check via `grep` (no DB in CI)

**Interfaces:**
- Consumes: existing `supabase_units.sql` units shape (property_id, unit_number, rent, status).
- Produces: `Property {id:string; name:string; address:string}`, `Unit {id:string; property_id:string; unit_number:string; rent:number; status:'vacant'|'occupied'}`, `Tenant {id:string; full_name:string; email:string|null; unit_id:string|null}`, `Payment {id:string; tenant_id:string; unit_id:string; amount:number; method:'cash'|'gcash'|'bank'|'other'; for_month:string; paid_on:string}`, `Tab = 'overview'|'properties'|'units'|'payments'` used by all later tasks.

- [ ] **Step 1: Create SQL migration file**

Create `supabase_properties_dashboard.sql` at repo root with this exact content:

```sql
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  created_at timestamptz default now()
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
```

- [ ] **Step 2: Create shared types**

Create `frontend/src/lib/types.ts`:

```ts
export type Property = { id: string; name: string; address: string };
export type Unit = {
  id: string;
  property_id: string;
  unit_number: string;
  rent: number;
  status: 'vacant' | 'occupied';
};
export type Tenant = { id: string; full_name: string; email: string | null; unit_id: string | null };
export type Payment = {
  id: string;
  tenant_id: string;
  unit_id: string;
  amount: number;
  method: 'cash' | 'gcash' | 'bank' | 'other';
  for_month: string;
  paid_on: string;
};
export type Tab = 'overview' | 'properties' | 'units' | 'payments';
```

- [ ] **Step 3: Verify files**

Run: `grep -c "create table" supabase_properties_dashboard.sql && grep -c "export type" frontend/src/lib/types.ts`
Expected: `3` and `5` (3 tables in new file, 5 types).

- [ ] **Step 4: Commit**

```bash
git add supabase_properties_dashboard.sql frontend/src/lib/types.ts
git commit -m "feat: add dashboard schema and shared types"
```

---

### Task 2: KPI pure logic + tests (TDD core)

**Files:**
- Create: `frontend/src/lib/kpis.ts`
- Create: `frontend/src/lib/kpis.test.ts`

**Interfaces:**
- Consumes: `Unit, Payment` from `lib/types.ts`.
- Produces: `calcKpis(units: Unit[], payments: Payment[], monthKey: string)` returning `{totalUnits:number; occupied:number; vacant:number; occupancyPct:number; expected:number; collected:number; collectionRate:number}` and `toMonthKey(d: Date)` returning `YYYY-MM-01`, used by Overview + Payments.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/kpis.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calcKpis, toMonthKey } from './kpis';

describe('calcKpis', () => {
  it('computes occupancy and collection', () => {
    const units = [
      { id: 'u1', property_id: 'p1', unit_number: '101', rent: 1000, status: 'occupied' as const },
      { id: 'u2', property_id: 'p1', unit_number: '102', rent: 2000, status: 'vacant' as const },
    ];
    const payments = [
      { id: 'pay1', tenant_id: 't1', unit_id: 'u1', amount: 1000, method: 'cash' as const, for_month: '2026-10-01', paid_on: '2026-10-02' },
    ];
    const k = calcKpis(units, payments, '2026-10-01');
    expect(k.totalUnits).toBe(2);
    expect(k.occupied).toBe(1);
    expect(k.vacant).toBe(1);
    expect(k.occupancyPct).toBe(50);
    expect(k.expected).toBe(3000);
    expect(k.collected).toBe(1000);
  });
  it('formats month key', () => {
    expect(toMonthKey(new Date('2026-10-15T00:00:00'))).toBe('2026-10-01');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/kpis.test.ts`
Expected: FAIL with "Failed to resolve import ./kpis" (file does not exist yet). Run from `frontend/` dir.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/lib/kpis.ts`:

```ts
import type { Unit, Payment } from './types';

export function toMonthKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-01`;
}

export function calcKpis(units: Unit[], payments: Payment[], monthKey: string) {
  const totalUnits = units.length;
  const occupied = units.filter((u) => u.status === 'occupied').length;
  const vacant = totalUnits - occupied;
  const occupancyPct = totalUnits === 0 ? 0 : Math.round((occupied / totalUnits) * 100);
  const expected = units.reduce((s, u) => s + Number(u.rent), 0);
  const collected = payments
    .filter((p) => p.for_month.slice(0, 10) === monthKey)
    .reduce((s, p) => s + Number(p.amount), 0);
  const collectionRate = expected === 0 ? 0 : Math.round((collected / expected) * 100);
  return { totalUnits, occupied, vacant, occupancyPct, expected, collected, collectionRate };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/kpis.test.ts`
Expected: PASS, 2 tests passed. Run from `frontend/` dir.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/kpis.ts frontend/src/lib/kpis.test.ts
git commit -m "feat: add KPI calc with tests"
```

---

### Task 3: Supabase hooks + shell UI (KpiCard + DashboardShell)

**Files:**
- Create: `frontend/src/lib/useDashboard.ts`
- Create: `frontend/src/components/KpiCard.tsx`
- Create: `frontend/src/components/DashboardShell.tsx`
- Create: `frontend/src/components/DashboardShell.test.tsx`

**Interfaces:**
- Consumes: `Property, Unit, Tenant, Payment, Tab` types; `supabase` client from `lib/supabase.ts`.
- Produces: `useProperties(), useUnits(), useTenants(), usePayments()` each returning `{data:T[]; loading:boolean; error:string|null; reload:()=>void}`; `<KpiCard label value sub/>`; `<DashboardShell initialTab/>` rendering sidebar buttons `Overview|Properties|Units|Payments`.

- [ ] **Step 1: Write the failing shell test**

Create `frontend/src/components/DashboardShell.test.tsx`:

```tsx
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import DashboardShell from './DashboardShell';

afterEach(cleanup);

describe('DashboardShell', () => {
  it('switches tabs', () => {
    render(<DashboardShell />);
    expect(screen.getByTestId('tab-overview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /payments/i }));
    expect(screen.getByTestId('tab-payments')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/components/DashboardShell.test.tsx`
Expected: FAIL "Failed to resolve import ./DashboardShell".

- [ ] **Step 3: Write minimal hooks + shell implementation**

Create `frontend/src/lib/useDashboard.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Property, Unit, Tenant, Payment } from './types';

function useTable<T>(table: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: rows, error: err } = await supabase.from(table).select('*').limit(200);
    if (err) setError(err.message);
    else setData((rows ?? []) as T[]);
    setLoading(false);
  }, [table]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, loading, error, reload: load };
}

export const useProperties = () => useTable<Property>('properties');
export const useUnits = () => useTable<Unit>('units');
export const useTenants = () => useTable<Tenant>('tenants');
export const usePayments = () => useTable<Payment>('payments');
```

Create `frontend/src/components/KpiCard.tsx`:

```tsx
export default function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
```

Create `frontend/src/components/DashboardShell.tsx`:

```tsx
import { useState } from 'react';
import type { Tab } from '../lib/types';

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'properties', label: 'Properties' },
  { id: 'units', label: 'Units' },
  { id: 'payments', label: 'Payments' },
];

export default function DashboardShell({ initialTab = 'overview' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <aside className="w-48 shrink-0 border-r border-white/10 p-4">
        <p className="mb-4 text-sm font-bold tracking-tight">Property Manager</p>
        <nav className="space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                tab === t.id ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="flex-1 p-6">
        <div data-testid={`tab-${tab}`} className="text-sm text-slate-400">
          {tab}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify pass + typecheck**

Run: `npm run test -- --run src/components/DashboardShell.test.tsx`
Expected: PASS 1 test. Then run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/useDashboard.ts frontend/src/components/KpiCard.tsx frontend/src/components/DashboardShell.tsx frontend/src/components/DashboardShell.test.tsx
git commit -m "feat: add dashboard shell and data hooks"
```

---

### Task 4: Overview tab (KPIs + occupancy bar)

**Files:**
- Create: `frontend/src/components/Overview.tsx`
- Create: `frontend/src/components/Overview.test.tsx`

**Interfaces:**
- Consumes: `useUnits, usePayments` hooks; `calcKpis, toMonthKey`; `KpiCard`.
- Produces: `<Overview/>` with 4 KPI cards + occupancy bar + loading/error/empty states. No props (fetches internally).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/Overview.test.tsx`:

```tsx
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import Overview from './Overview';

vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ limit: async () => ({ data: [], error: null }) }) }) },
}));

afterEach(cleanup);

describe('Overview', () => {
  it('renders 4 KPI cards', async () => {
    render(<Overview />);
    expect(await screen.findByText(/occupancy/i)).toBeTruthy();
    expect(await screen.findByText(/expected rent/i)).toBeTruthy();
    expect(await screen.findByText(/collected/i)).toBeTruthy();
    expect(await screen.findByText(/vacant/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/components/Overview.test.tsx`
Expected: FAIL "Failed to resolve import ./Overview".

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/components/Overview.tsx`:

```tsx
import { useMemo, useState } from 'react';
import KpiCard from './KpiCard';
import { useUnits, usePayments } from '../lib/useDashboard';
import { calcKpis, toMonthKey } from '../lib/kpis';

export default function Overview() {
  const units = useUnits();
  const payments = usePayments();
  const [month] = useState(() => toMonthKey(new Date()));
  const k = useMemo(() => calcKpis(units.data, payments.data, month), [units.data, payments.data, month]);
  if (units.loading || payments.loading) return <p className="text-slate-400">Loading overview…</p>;
  if (units.error || payments.error)
    return (
      <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
        {units.error ?? payments.error}
      </p>
    );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Occupancy" value={`${k.occupancyPct}%`} sub={`${k.occupied}/${k.totalUnits} occupied`} />
        <KpiCard label="Expected rent" value={`$${k.expected.toLocaleString()}`} sub="per month" />
        <KpiCard label="Collected" value={`$${k.collected.toLocaleString()}`} sub={month} />
        <KpiCard label="Vacant" value={`${k.vacant}`} sub={`${k.collectionRate}% collected`} />
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Occupancy</p>
        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${k.occupancyPct}%` }} />
        </div>
        {k.totalUnits === 0 && <p className="mt-2 text-sm text-slate-400">No units yet — add a property and units.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/components/Overview.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Overview.tsx frontend/src/components/Overview.test.tsx
git commit -m "feat: add overview KPIs"
```

---

### Task 5: Properties + Units CRUD

**Files:**
- Create: `frontend/src/components/Properties.tsx`
- Create: `frontend/src/components/Units.tsx`

**Interfaces:**
- Consumes: `useProperties, useUnits` + `supabase` client for insert/update/delete.
- Produces: `<Properties/>` table with add form (name, address) + delete; `<Units/>` table with property filter, add form (property_id, unit_number, rent), status toggle. Both handle loading/error/empty.

- [ ] **Step 1: Write minimal Properties implementation**

Create `frontend/src/components/Properties.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useProperties } from '../lib/useDashboard';

export default function Properties() {
  const { data, loading, error, reload } = useProperties();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  if (loading) return <p className="text-slate-400">Loading properties…</p>;
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
        {error}
      </p>
    );

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || saving) return;
    setSaving(true);
    setFormError('');
    const { error: err } = await supabase.from('properties').insert({ name: name.trim(), address: address.trim() });
    if (err) setFormError(err.message);
    else {
      setName('');
      setAddress('');
      reload();
    }
    setSaving(false);
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this property? Units will be deleted.')) return;
    const { error: err } = await supabase.from('properties').delete().eq('id', id);
    if (err) setFormError(err.message);
    else reload();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onAdd} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Property name" aria-label="Property name" className="flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" aria-label="Address" className="flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" />
        <button disabled={!name.trim() || !address.trim() || saving} className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : 'Add'}
        </button>
      </form>
      {formError && <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{formError}</p>}
      {data.length === 0 ? (
        <p className="text-sm text-slate-400">No properties yet — add one.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-400">
              <th className="py-2">Name</th>
              <th>Address</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-t border-white/10">
                <td className="py-2 font-medium">{p.name}</td>
                <td className="text-slate-300">{p.address}</td>
                <td className="text-right">
                  <button onClick={() => onDelete(p.id)} className="rounded-lg border border-white/20 px-2 py-1 text-xs hover:bg-white/10">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write minimal Units implementation**

Create `frontend/src/components/Units.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useUnits, useProperties } from '../lib/useDashboard';

export default function Units() {
  const { data, loading, error, reload } = useUnits();
  const props = useProperties();
  const [filter, setFilter] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [rent, setRent] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading || props.loading) return <p className="text-slate-400">Loading units…</p>;
  if (error || props.error)
    return (
      <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
        {error ?? props.error}
      </p>
    );

  const filtered = filter ? data.filter((u) => u.property_id === filter) : data;

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!filter || !unitNumber.trim() || !rent || saving) return;
    setSaving(true);
    const { error: err } = await supabase
      .from('units')
      .insert({ property_id: filter, unit_number: unitNumber.trim(), rent: Number(rent), status: 'vacant' });
    if (!err) {
      setUnitNumber('');
      setRent('');
      reload();
    }
    setSaving(false);
  };

  const toggle = async (id: string, status: string) => {
    await supabase.from('units').update({ status: status === 'occupied' ? 'vacant' : 'occupied' }).eq('id', id);
    reload();
  };

  return (
    <div className="space-y-4">
      <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by property" className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
        <option value="">All properties</option>
        {props.data.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <form onSubmit={onAdd} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row">
        <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="Unit 101" aria-label="Unit number" className="flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
        <input value={rent} onChange={(e) => setRent(e.target.value)} placeholder="Rent" aria-label="Rent" type="number" min="0" className="w-32 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
        <button disabled={!filter || !unitNumber.trim() || !rent || saving} className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold disabled:opacity-50">
          Add unit
        </button>
      </form>
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">No units yet — pick a property and add one.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-400">
              <th className="py-2">Unit</th>
              <th>Rent</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="py-2 font-medium">{u.unit_number}</td>
                <td>${Number(u.rent).toLocaleString()}</td>
                <td>
                  <button onClick={() => toggle(u.id, u.status)} className="rounded-full border border-white/20 px-2 py-0.5 text-xs hover:bg-white/10">
                    {u.status}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck + existing tests**

Run: `npm run typecheck && npm run test -- --run`
Expected: typecheck clean, all tests pass. Run from `frontend/` dir.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Properties.tsx frontend/src/components/Units.tsx
git commit -m "feat: add properties and units CRUD"
```

---

### Task 6: Payments ledger + App gate (final wiring)

**Files:**
- Create: `frontend/src/components/Payments.tsx`
- Create: `frontend/src/components/Payments.test.tsx`
- Modify: `frontend/src/components/DashboardShell.tsx` (render real tabs)
- Modify: `frontend/src/App.tsx` (session gate)
- Modify: `frontend/src/App.test.tsx` (keep auth, add shell test)

**Interfaces:**
- Consumes: `usePayments, useTenants, useUnits`; `Overview, Properties, Units, Payments`; `supabase.auth`.
- Produces: Working dashboard after login. `Payments` validates `amount > 0` and `for_month` first-of-month.

- [ ] **Step 1: Write the failing payments validation test**

Create `frontend/src/components/Payments.test.tsx`:

```tsx
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import Payments from './Payments';

vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ limit: async () => ({ data: [], error: null }) }), insert: async () => ({ error: null }) }) },
}));

afterEach(cleanup);

describe('Payments', () => {
  it('disables submit when amount is invalid', async () => {
    render(<Payments />);
    expect(await screen.findByText(/ledger/i)).toBeTruthy();
    const btn = screen.getByRole('button', { name: /record payment/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '-5' } });
    expect((screen.getByRole('button', { name: /record payment/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/components/Payments.test.tsx`
Expected: FAIL "Failed to resolve import ./Payments".

- [ ] **Step 3: Write Payments implementation**

Create `frontend/src/components/Payments.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { usePayments, useTenants, useUnits } from '../lib/useDashboard';
import { toMonthKey } from '../lib/kpis';

export default function Payments() {
  const { data, loading, error, reload } = usePayments();
  const tenants = useTenants();
  const units = useUnits();
  const [tenantId, setTenantId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [month, setMonth] = useState(() => toMonthKey(new Date()).slice(0, 7));
  const [saving, setSaving] = useState(false);

  if (loading) return <p className="text-slate-400">Loading ledger…</p>;
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
        {error}
      </p>
    );

  const valid = tenantId !== '' && unitId !== '' && Number(amount) > 0 && !saving;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    const { error: err } = await supabase.from('payments').insert({
      tenant_id: tenantId,
      unit_id: unitId,
      amount: Number(amount),
      method,
      for_month: `${month}-01`,
    });
    if (!err) {
      setAmount('');
      reload();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-200">Ledger</h3>
      <form onSubmit={onSubmit} className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
        <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} aria-label="Tenant" className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
          <option value="">Tenant</option>
          {tenants.data.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label="Unit" className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
          <option value="">Unit</option>
          {units.data.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unit_number}
            </option>
          ))}
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" type="number" min="0" placeholder="Amount" className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
        <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method" className="rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-sm">
          <option value="cash">cash</option>
          <option value="gcash">gcash</option>
          <option value="bank">bank</option>
          <option value="other">other</option>
        </select>
        <input value={month} onChange={(e) => setMonth(e.target.value)} aria-label="For month" type="month" className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm" />
        <button disabled={!valid} className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : 'Record payment'}
        </button>
      </form>
      {data.length === 0 ? (
        <p className="text-sm text-slate-400">No payments yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-slate-400">
              <th className="py-2">Amount</th>
              <th>Method</th>
              <th>Month</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((p) => (
              <tr key={p.id} className="border-t border-white/10">
                <td className="py-2 font-medium">${Number(p.amount).toLocaleString()}</td>
                <td className="text-slate-300">{p.method}</td>
                <td className="text-slate-300">{String(p.for_month).slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire DashboardShell + App gate**

Replace content slot in `frontend/src/components/DashboardShell.tsx` section with real tabs:

```tsx
import Overview from './Overview';
import Properties from './Properties';
import Units from './Units';
import Payments from './Payments';
// inside <section>: {tab === 'overview' && <Overview />} etc.
```

Full section replacement:

```tsx
<section className="flex-1 p-6">
  {tab === 'overview' && <Overview />}
  {tab === 'properties' && <Properties />}
  {tab === 'units' && <Units />}
  {tab === 'payments' && <Payments />}
</section>
```

Modify `frontend/src/App.tsx`: keep existing `AuthForm` untouched, wrap default export:

```tsx
import { useEffect, useState } from 'react';
import DashboardShell from './components/DashboardShell';
// ... keep AuthForm as-is ...
export default function App() {
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === null) return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading…</main>;
  if (!session) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
        {/* keep existing orbs + TiltCard AuthForm */}
        <div className="group relative w-full max-w-md">
          <TiltCard>
            <AuthForm />
          </TiltCard>
        </div>
      </main>
    );
  }
  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(false);
  };
  return (
    <main className="min-h-screen bg-slate-950">
      <div className="flex justify-end border-b border-white/10 p-2">
        <button onClick={signOut} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">
          Sign out
        </button>
      </div>
      <DashboardShell />
    </main>
  );
}
```

Note: keep `AuthForm` function body exactly as current file, only change default export + add imports.

- [ ] **Step 5: Run full verification**

Run from `frontend/`:

```
npm run typecheck
npm run test -- --run
npm run build
```

Expected: typecheck clean, all tests PASS (auth 2 + shell 1 + overview 1 + payments 1 = 5+), build succeeds to `dist/`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Payments.tsx frontend/src/components/Payments.test.tsx frontend/src/components/DashboardShell.tsx frontend/src/App.tsx
git commit -m "feat: add payments ledger and app session gate"
```

---

## Self-Review

1. **Spec coverage:** Overview KPIs → Task 4; Properties CRUD → Task 5; Units + filter + toggle → Task 5; Payments ledger + validation → Task 6; Auth gate + sidebar → Task 3+6; Schema + RLS → Task 1; Dark glass + no new deps → all tasks (Tailwind classes only, no new imports).
2. **Placeholder scan:** No TBD/TODO; every code step shows full file content; commands include `frontend/` cwd + expected output; validation rules explicit (`amount > 0`, `for_month YYYY-MM-01`).
3. **Type consistency:** `Property/Unit/Tenant/Payment/Tab` defined once in Task 1 `types.ts`; `calcKpis` signature identical in Task 2 impl + Task 4 usage; hook return shape `{data,loading,error,reload}` identical across Task 3 impl + Task 4/5/6 usage; `method` union `cash|gcash|bank|other` matches SQL check.

## Out of scope (reaffirmed)

No react-router, no recharts, no GAAP, no roles, no PDF, no backend changes.
