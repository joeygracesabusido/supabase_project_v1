import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useProperties, useUnits } from '../lib/useDashboard';

export default function Properties() {
  const { data, loading, error, reload } = useProperties();
  const units = useUnits();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  if (loading) return <p className="text-[var(--text-secondary)]">Loading properties…</p>;
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

  const unitCount = (propertyId: string) =>
    units.data.filter((u) => u.property_id === propertyId).length;

  const accents = [
    { bar: 'bg-gradient-to-r from-indigo-500 to-fuchsia-500', badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-200' },
    { bar: 'bg-gradient-to-r from-sky-500 to-cyan-400', badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-200' },
    { bar: 'bg-gradient-to-r from-emerald-500 to-teal-400', badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' },
    { bar: 'bg-gradient-to-r from-amber-500 to-orange-400', badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-200' },
    { bar: 'bg-gradient-to-r from-rose-500 to-pink-400', badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-200' },
  ];

  return (
    <div className="space-y-4">
      <form onSubmit={onAdd} className="flex flex-col gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)] sm:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Property name" aria-label="Property name" className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-400" />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" aria-label="Address" className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-400" />
        <button disabled={!name.trim() || !address.trim() || saving} className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Add'}
        </button>
      </form>
      {formError && <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{formError}</p>}
      {data.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No properties yet — add one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p, i) => (
            <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
              <div aria-hidden className={`h-2 ${accents[i % accents.length].bar}`} />
              <div className="flex flex-1 flex-col p-5">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">{p.name}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{p.address}</p>
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-light)] pt-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${accents[i % accents.length].badge}`}>
                  {unitCount(p.id)} {unitCount(p.id) === 1 ? 'unit' : 'units'}
                </span>
                <button onClick={() => onDelete(p.id)} className="rounded-lg border border-[var(--border-color)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
                  Delete
                </button>
              </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
