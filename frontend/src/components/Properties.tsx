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
