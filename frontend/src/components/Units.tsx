import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUnits, useProperties } from '../lib/useDashboard';
import type { Unit } from '../lib/types';
import { Pagination } from './ui/Pagination';
import { ConfirmDialog } from './ui/ConfirmDialog';

const PAGE_SIZE = 9;

const inputCls =
  'mt-1.5 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-400';

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

export default function Units() {
  const { data, loading, error, reload } = useUnits();
  const props = useProperties();
  const [searchParams] = useSearchParams();
  const initialProperty = searchParams.get('property') ?? '';
  const [filter, setFilter] = useState(initialProperty);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<'number' | 'rentAsc' | 'rentDesc'>('number');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [rent, setRent] = useState('');
  const [status, setStatus] = useState('vacant');
  const [floorArea, setFloorArea] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [unitType, setUnitType] = useState('');
  const [phase, setPhase] = useState('');
  const [block, setBlock] = useState('');
  const [lot, setLot] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  // Deep link from a property card (?property=<id>&add=1): preset the
  // property and open the Add modal once its data has loaded.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || props.loading || showModal) return;
    if (searchParams.get('add') === '1' && initialProperty && props.data.some((p) => p.id === initialProperty)) {
      autoOpened.current = true;
      setPropertyId(initialProperty);
      setEditing(null);
      setFormError('');
      setShowModal(true);
    }
  }, [props.loading, props.data, searchParams, initialProperty, showModal]);

  // Hooks must run before any early return: while loading, data is just [].
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = filter ? data.filter((u) => u.property_id === filter) : [...data];
    if (statusFilter) rows = rows.filter((u) => u.status === statusFilter);
    if (q) {
      rows = rows.filter((u) =>
        [u.unit_number, u.unit_type ?? '', u.phase ?? '', u.block ?? '', u.lot ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    rows.sort((a, b) => {
      if (sort === 'rentAsc') return Number(a.rent) - Number(b.rent);
      if (sort === 'rentDesc') return Number(b.rent) - Number(a.rent);
      return a.unit_number.localeCompare(b.unit_number);
    });
    return rows;
  }, [data, filter, search, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading || props.loading) return <p className="text-[var(--text-secondary)]">Loading units…</p>;
  if (error || props.error)
    return (
      <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
        {error ?? props.error}
      </p>
    );

  const propName = (id: string) => props.data.find((p) => p.id === id)?.name ?? '—';

  const rentNum = rent.trim() === '' ? null : Number(rent);
  const rentValid = rentNum !== null && !Number.isNaN(rentNum) && rentNum > 0;
  const formValid =
    (editing ? true : propertyId !== '') &&
    unitNumber.trim() !== '' &&
    rentValid &&
    !saving;

  const resetFields = () => {
    setPropertyId(filter);
    setUnitNumber('');
    setRent('');
    setStatus('vacant');
    setFloorArea('');
    setFloorNumber('');
    setBedrooms('');
    setBathrooms('');
    setUnitType('');
    setPhase('');
    setBlock('');
    setLot('');
    setDescription('');
  };

  const openAdd = () => {
    resetFields();
    setEditing(null);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (u: Unit) => {
    setPropertyId(u.property_id);
    setUnitNumber(u.unit_number);
    setRent(String(u.rent));
    setStatus(u.status);
    setFloorArea(u.floor_area != null ? String(u.floor_area) : '');
    setFloorNumber(u.floor_number != null ? String(u.floor_number) : '');
    setBedrooms(u.bedroom_count != null ? String(u.bedroom_count) : '');
    setBathrooms(u.bathroom_count != null ? String(u.bathroom_count) : '');
    setUnitType(u.unit_type ?? '');
    setPhase(u.phase ?? '');
    setBlock(u.block ?? '');
    setLot(u.lot ?? '');
    setDescription(u.description ?? '');
    setEditing(u);
    setFormError('');
    setShowModal(true);
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!formValid) return;
    setSaving(true);
    setFormError('');
    const payload = {
      property_id: editing ? editing.property_id : propertyId,
      unit_number: unitNumber.trim(),
      rent: rentNum,
      status,
      floor_area: numOrNull(floorArea),
      floor_number: numOrNull(floorNumber),
      bedroom_count: numOrNull(bedrooms),
      bathroom_count: numOrNull(bathrooms),
      unit_type: unitType.trim() || null,
      phase: phase.trim() || null,
      block: block.trim() || null,
      lot: lot.trim() || null,
      description: description.trim() || null,
    };
    const { error: err } = editing
      ? await supabase.from('units').update(payload).eq('id', editing.id)
      : await supabase.from('units').insert(payload);
    if (err) setFormError(err.message);
    else {
      resetFields();
      setEditing(null);
      setShowModal(false);
      reload();
    }
    setSaving(false);
  };

  const onDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const { error: err } = await supabase.from('units').delete().eq('id', deleteTarget.id);
    if (err) setFormError(err.message);
    else reload();
    setDeleting(false);
    setDeleteTarget(null);
  };

  const toggle = async (u: Unit) => {
    if (togglingId) return;
    setTogglingId(u.id);
    const { error: err } = await supabase
      .from('units')
      .update({ status: u.status === 'occupied' ? 'vacant' : 'occupied' })
      .eq('id', u.id);
    if (err) setFormError(err.message);
    else reload();
    setTogglingId(null);
  };

  const accents = [
    { bar: 'bg-gradient-to-r from-indigo-500 to-fuchsia-500', badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-200' },
    { bar: 'bg-gradient-to-r from-sky-500 to-cyan-400', badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-200' },
    { bar: 'bg-gradient-to-r from-emerald-500 to-teal-400', badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200' },
    { bar: 'bg-gradient-to-r from-amber-500 to-orange-400', badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-200' },
    { bar: 'bg-gradient-to-r from-rose-500 to-pink-400', badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-200' },
  ];

  const specs = (u: Unit) =>
    [
      u.bedroom_count != null && `${u.bedroom_count} br`,
      u.bathroom_count != null && `${u.bathroom_count} ba`,
      u.floor_area != null && `${Number(u.floor_area)} sqm`,
      u.floor_number != null && `fl ${u.floor_number}`,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} aria-label="Filter by property" className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]">
            <option value="">All properties</option>
            {props.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search units…"
            aria-label="Search units"
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-indigo-400 sm:w-44"
          />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} aria-label="Filter by status" className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]">
            <option value="">All statuses</option>
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort units" className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]">
            <option value="number">Sort: Number</option>
            <option value="rentAsc">Sort: Rent ↑</option>
            <option value="rentDesc">Sort: Rent ↓</option>
          </select>
        </div>
        <button onClick={openAdd} className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110">
          Add Unit
        </button>
      </div>
      {formError && !showModal && <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{formError}</p>}
      {showModal && (
        <div onClick={() => setShowModal(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-label={editing ? 'Edit unit' : 'Add unit'} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-lg)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{editing ? 'Edit Unit' : 'Add Unit'}</h2>
            <form onSubmit={onSave} className="mt-4 space-y-3">
              {!editing && (
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Property *
                  <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} aria-label="Property" className={inputCls}>
                    <option value="">Select property</option>
                    {props.data.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Unit Number *
                  <input autoFocus value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="Unit 101" aria-label="Unit number" className={inputCls} />
                </label>
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Rent *
                  <input value={rent} onChange={(e) => setRent(e.target.value)} type="number" min="0" placeholder="15000" aria-label="Rent" className={inputCls} />
                </label>
              </div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Status
                <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={inputCls}>
                  <option value="vacant">Vacant</option>
                  <option value="occupied">Occupied</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Floor Area (sqm)
                  <input value={floorArea} onChange={(e) => setFloorArea(e.target.value)} type="number" min="0" aria-label="Floor area" className={inputCls} />
                </label>
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Floor #
                  <input value={floorNumber} onChange={(e) => setFloorNumber(e.target.value)} type="number" aria-label="Floor number" className={inputCls} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Bedrooms
                  <input value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} type="number" min="0" aria-label="Bedrooms" className={inputCls} />
                </label>
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Bathrooms
                  <input value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} type="number" min="0" aria-label="Bathrooms" className={inputCls} />
                </label>
              </div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Unit Type
                <input value={unitType} onChange={(e) => setUnitType(e.target.value)} placeholder="e.g. studio, 1BR" aria-label="Unit type" className={inputCls} />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Phase
                  <input value={phase} onChange={(e) => setPhase(e.target.value)} aria-label="Phase" className={inputCls} />
                </label>
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Block
                  <input value={block} onChange={(e) => setBlock(e.target.value)} aria-label="Block" className={inputCls} />
                </label>
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Lot
                  <input value={lot} onChange={(e) => setLot(e.target.value)} aria-label="Lot" className={inputCls} />
                </label>
              </div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Description
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} aria-label="Description" className={`${inputCls} resize-none`} />
              </label>
              {formError && <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
                  Cancel
                </button>
                <button disabled={!formValid} className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {search || statusFilter ? 'No units match your filters.' : 'No units yet — pick a property and add one.'}
        </p>
      ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageRows.map((u, i) => (
            <article key={u.id} className="flex flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
              <div aria-hidden className={`h-2 ${accents[i % accents.length].bar}`} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">{u.unit_number}</h2>
                    <p className="text-sm text-[var(--text-secondary)]">{propName(u.property_id)}</p>
                  </div>
                  <button onClick={() => toggle(u)} disabled={togglingId === u.id} title="Toggle vacant/occupied" className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${u.status === 'occupied' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200' : 'bg-amber-500/15 text-amber-700 dark:text-amber-200'}`}>
                    {u.status}
                  </button>
                </div>
                <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">${Number(u.rent).toLocaleString()}</p>
                {(specs(u) || u.unit_type) && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {[u.unit_type, specs(u)].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-[var(--border-light)] pt-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${accents[i % accents.length].badge}`}>
                    {[u.phase, u.block, u.lot].filter(Boolean).join('-') || '—'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(u)} aria-label={`Edit ${u.unit_number}`} title="Edit" className="rounded-lg border border-[var(--border-color)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                    <button onClick={() => setDeleteTarget(u)} aria-label={`Delete ${u.unit_number}`} className="rounded-lg border border-[var(--border-color)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
        <Pagination page={safePage} totalPages={totalPages} total={filtered.length} onPageChange={setPage} />
        </>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete unit?"
        message={deleteTarget ? `Unit ${deleteTarget.unit_number} will be deleted. Payments for it will be deleted.` : ''}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        danger
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
