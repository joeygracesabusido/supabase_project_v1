import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useProperties, useUnits } from '../lib/useDashboard';
import type { Property } from '../lib/types';

const BUILDING_TYPES = ['residential', 'commercial', 'mixed', 'industrial', 'condominium', 'townhouse'];
const thisYear = new Date().getFullYear();
const inputCls =
  'mt-1.5 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-400';

export default function Properties() {
  const { data, loading, error, reload } = useProperties();
  const units = useUnits();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [totalUnits, setTotalUnits] = useState('');
  const [buildingType, setBuildingType] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [assetCategory, setAssetCategory] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  if (loading) return <p className="text-[var(--text-secondary)]">Loading properties…</p>;
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
        {error}
      </p>
    );

  const resetFields = () => {
    setName('');
    setAddress('');
    setCity('');
    setState('');
    setZip('');
    setTotalUnits('');
    setBuildingType('');
    setYearBuilt('');
    setAssetCategory('');
    setDescription('');
  };

  const openAdd = () => {
    resetFields();
    setEditing(null);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (p: Property) => {
    setName(p.name);
    setAddress(p.address);
    setCity(p.city ?? '');
    setState(p.state ?? '');
    setZip(p.zip ?? '');
    setTotalUnits(p.total_units != null ? String(p.total_units) : '');
    setBuildingType(p.building_type ?? '');
    setYearBuilt(p.year_built != null ? String(p.year_built) : '');
    setAssetCategory(p.asset_category ?? '');
    setDescription(p.description ?? '');
    setEditing(p);
    setFormError('');
    setShowModal(true);
  };
  const yearNum = yearBuilt.trim() === '' ? null : Number(yearBuilt);
  const unitsNum = totalUnits.trim() === '' ? null : Number(totalUnits);
  const yearValid = yearNum === null || (Number.isInteger(yearNum) && yearNum >= 1800 && yearNum <= thisYear);
  const unitsValid = unitsNum === null || (!Number.isNaN(unitsNum) && unitsNum >= 0);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !yearValid || !unitsValid || saving) return;
    setSaving(true);
    setFormError('');
    const payload = {
      name: name.trim(),
      address: address.trim(),
      city: city.trim() || null,
      state: state.trim() || null,
      zip: zip.trim() || null,
      total_units: unitsNum,
      building_type: buildingType || null,
      year_built: yearNum,
      asset_category: assetCategory.trim() || null,
      description: description.trim() || null,
    };
    const { error: err } = editing
      ? await supabase.from('properties').update(payload).eq('id', editing.id)
      : await supabase.from('properties').insert(payload);
    if (err) setFormError(err.message);
    else {
      resetFields();
      setEditing(null);
      setShowModal(false);
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

  const locality = (p: { city?: string | null; state?: string | null; zip?: string | null }) =>
    [p.city, p.state, p.zip].filter(Boolean).join(', ');

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openAdd} className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110">
          Add Property
        </button>
      </div>
      {showModal && (
        <div onClick={() => setShowModal(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-label={editing ? 'Edit property' : 'Add property'} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-lg)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{editing ? 'Edit Property' : 'Add Property'}</h2>
            <form onSubmit={onSave} className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Property Name *
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunrise Residences" aria-label="Property name" className={inputCls} />
              </label>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Address *
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Rizal Street" aria-label="Address" className={inputCls} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  City
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Makati" aria-label="City" className={inputCls} />
                </label>
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Province / State
                  <input value={state} onChange={(e) => setState(e.target.value)} placeholder="Metro Manila" aria-label="Province or state" className={inputCls} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  ZIP
                  <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="1200" aria-label="ZIP code" className={inputCls} />
                </label>
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Total Units
                  <input value={totalUnits} onChange={(e) => setTotalUnits(e.target.value)} type="number" min="0" placeholder="0" aria-label="Total units" className={inputCls} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Building Type
                  <select value={buildingType} onChange={(e) => setBuildingType(e.target.value)} aria-label="Building type" className={inputCls}>
                    <option value="">Select type</option>
                    {BUILDING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t[0].toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Year Built
                  <input value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} type="number" min="1800" max={thisYear} placeholder="e.g. 2015" aria-label="Year built" className={inputCls} />
                </label>
              </div>
              {!yearValid && <p className="text-xs text-red-400">Year built must be between 1800 and {thisYear}.</p>}
              {!unitsValid && <p className="text-xs text-red-400">Total units must be 0 or more.</p>}
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Asset Category
                <input value={assetCategory} onChange={(e) => setAssetCategory(e.target.value)} placeholder="e.g. commercial" aria-label="Asset category" className={inputCls} />
              </label>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Description
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Brief description of the property…" aria-label="Description" className={`${inputCls} resize-none`} />
              </label>
              {formError && <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
                  Cancel
                </button>
                <button disabled={!name.trim() || !address.trim() || !yearValid || !unitsValid || saving} className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {data.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No properties yet — add one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p, i) => (
            <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
              <div aria-hidden className={`h-2 ${accents[i % accents.length].bar}`} />
              <div className="flex flex-1 flex-col p-5">
              <Link to={`/units?property=${p.id}&add=1`} title={`Add units to ${p.name}`} className="rounded-lg outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-indigo-400">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">{p.name}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{p.address}</p>
                {locality(p) && <p className="text-sm text-[var(--text-muted)]">{locality(p)}</p>}
              </Link>
              {p.building_type && (
                <span className="mt-2 w-fit rounded-full bg-[var(--bg-badge)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--text-secondary)]">
                  {p.building_type}
                </span>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--border-light)] pt-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${accents[i % accents.length].badge}`}>
                  {unitCount(p.id)} {unitCount(p.id) === 1 ? 'unit' : 'units'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`} title="Edit" className="rounded-lg border border-[var(--border-color)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button onClick={() => onDelete(p.id)} className="rounded-lg border border-[var(--border-color)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
                    Delete
                  </button>
                </div>
              </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
