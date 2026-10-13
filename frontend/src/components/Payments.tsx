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
