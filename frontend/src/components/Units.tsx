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
