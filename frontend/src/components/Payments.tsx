import { useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { usePayments, useTenants, useUnits } from '../lib/useDashboard';
import { toMonthKey } from '../lib/kpis';
import { Badge } from './ui/Badge';
import { Pagination } from './ui/Pagination';

const PAGE_SIZE = 15;

// Ledger, extended with the el-property PaymentsPage filtration workflow
// (method + month filters, search, paginated table, collected total),
// backed by this app's Supabase `payments` table.
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
  const [methodFilter, setMethodFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const tenantName = (id: string) => tenants.data.find((t) => t.id === id)?.full_name ?? '—';
  const unitLabel = (id: string) => units.data.find((u) => u.id === id)?.unit_number ?? '—';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((p) => {
      if (methodFilter && p.method !== methodFilter) return false;
      if (monthFilter && !String(p.for_month).startsWith(monthFilter)) return false;
      if (q && !`${tenantName(p.tenant_id)} ${unitLabel(p.unit_id)}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [data, methodFilter, monthFilter, search, tenants.data, units.data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filteredTotal = filtered.reduce((s, p) => s + Number(p.amount), 0);

  if (loading) return <p className="text-slate-400">Loading ledger…</p>;
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
        {error}
      </p>
    );

  const valid = tenantId !== '' && unitId !== '' && Number(amount) > 0 && month !== '' && !saving;

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

      <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by tenant or unit…"
          aria-label="Search payments"
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-indigo-400 sm:max-w-xs"
        />
        <select value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }} aria-label="Filter by method" className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]">
          <option value="">All methods</option>
          <option value="cash">cash</option>
          <option value="gcash">gcash</option>
          <option value="bank">bank</option>
          <option value="other">other</option>
        </select>
        <input
          value={monthFilter}
          onChange={(e) => {
            setMonthFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by month"
          type="month"
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        <p className="text-sm text-[var(--text-secondary)] sm:ml-auto">
          Total: <span className="font-semibold text-[var(--text-primary)]">${filteredTotal.toLocaleString()}</span>
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">
          {data.length === 0 ? 'No payments yet.' : 'No payments match your filters.'}
        </p>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-slate-400">
                <th className="py-2">Amount</th>
                <th>Method</th>
                <th>Tenant</th>
                <th>Unit</th>
                <th>Month</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <tr key={p.id} className="border-t border-white/10">
                  <td className="py-2 font-medium">${Number(p.amount).toLocaleString()}</td>
                  <td>
                    <Badge status={p.method} />
                  </td>
                  <td className="text-slate-300">{tenantName(p.tenant_id)}</td>
                  <td className="text-slate-300">{unitLabel(p.unit_id)}</td>
                  <td className="text-slate-300">{String(p.for_month).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={safePage} totalPages={totalPages} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
