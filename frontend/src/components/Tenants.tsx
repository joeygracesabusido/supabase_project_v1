import { useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useTenants, useUnits } from '../lib/useDashboard';
import type { Tenant } from '../lib/types';
import { Badge } from './ui/Badge';
import { Pagination } from './ui/Pagination';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { formatDate } from '../lib/format';

const PAGE_SIZE = 12;

const inputCls =
  'mt-1.5 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-400';

// Tenants tab, adapted from el-property TenantsPage card layout + search /
// pagination workflow, rewritten for this app's Supabase `tenants` table
// (full_name, email, unit_id, lease_start, lease_end).
export default function Tenants() {
  const { data, loading, error, reload } = useTenants();
  const units = useUnits();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [unitId, setUnitId] = useState('');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        (t.email ?? '').toLowerCase().includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const unitLabel = (id: string | null) =>
    id ? (units.data.find((u) => u.id === id)?.unit_number ?? '—') : 'No unit';

  if (loading || units.loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            aria-hidden
            className="h-36 animate-pulse rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5"
          />
        ))}
      </div>
    );
  }

  if (error || units.error) {
    return (
      <div className="py-16 text-center text-[var(--text-muted)]">
        <p className="font-medium text-red-500">Failed to load tenants</p>
        <p className="mb-4 text-sm">{error ?? units.error}</p>
        <button
          onClick={() => {
            reload();
            units.reload();
          }}
          className="rounded-lg bg-[#003580] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#00224f]"
        >
          Retry
        </button>
      </div>
    );
  }

  const resetFields = () => {
    setFullName('');
    setEmail('');
    setUnitId('');
    setLeaseStart('');
    setLeaseEnd('');
  };

  const openAdd = () => {
    resetFields();
    setEditing(null);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (t: Tenant) => {
    setFullName(t.full_name);
    setEmail(t.email ?? '');
    setUnitId(t.unit_id ?? '');
    setLeaseStart(t.lease_start ?? '');
    setLeaseEnd(t.lease_end ?? '');
    setEditing(t);
    setFormError('');
    setShowModal(true);
  };

  const emailValid = email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const formValid = fullName.trim() !== '' && emailValid && !saving;

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!formValid) return;
    setSaving(true);
    setFormError('');
    const payload = {
      full_name: fullName.trim(),
      email: email.trim() || null,
      unit_id: unitId || null,
      lease_start: leaseStart || null,
      lease_end: leaseEnd || null,
    };
    const { error: err } = editing
      ? await supabase.from('tenants').update(payload).eq('id', editing.id)
      : await supabase.from('tenants').insert(payload);
    if (err) setFormError(err.message);
    else {
      resetFields();
      setEditing(null);
      setShowModal(false);
      reload();
    }
    setSaving(false);
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const { error: err } = await supabase.from('tenants').delete().eq('id', deleteTarget.id);
    if (err) setFormError(err.message);
    else reload();
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search tenants…"
          aria-label="Search tenants"
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-indigo-400 sm:max-w-sm"
        />
        <button
          onClick={openAdd}
          className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
        >
          Add Tenant
        </button>
      </div>
      {formError && !showModal && (
        <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
          {formError}
        </p>
      )}

      {showModal && (
        <div onClick={() => setShowModal(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Edit tenant' : 'Add tenant'}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-lg)]"
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {editing ? 'Edit Tenant' : 'Add Tenant'}
            </h2>
            <form onSubmit={onSave} className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Full Name *
                <input
                  autoFocus
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  aria-label="Full name"
                  className={inputCls}
                />
              </label>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Email
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="tenant@example.com"
                  aria-label="Email"
                  className={inputCls}
                />
              </label>
              {!emailValid && <p className="text-xs text-red-400">Enter a valid email address.</p>}
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Unit
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label="Unit" className={inputCls}>
                  <option value="">No unit assigned</option>
                  {units.data.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unit_number}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Lease Start
                  <input value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} type="date" aria-label="Lease start" className={inputCls} />
                </label>
                <label className="block text-sm font-medium text-[var(--text-secondary)]">
                  Lease End
                  <input value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} type="date" aria-label="Lease end" className={inputCls} />
                </label>
              </div>
              {formError && (
                <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
                  {formError}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                >
                  Cancel
                </button>
                <button
                  disabled={!formValid}
                  className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editing ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-[var(--text-muted)]">
          <p className="font-medium">{search ? 'No tenants match your search' : 'No tenants yet — add one.'}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {pageRows.map((t) => (
              <article
                key={t.id}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 transition-shadow hover:shadow-[var(--shadow-md)]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#003580] text-sm font-bold text-white">
                      {t.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{t.full_name}</p>
                      {t.email && <p className="truncate text-xs text-[var(--text-secondary)]">{t.email}</p>}
                    </div>
                  </div>
                  <Badge status={t.unit_id ? 'occupied' : 'vacant'} label={t.unit_id ? unitLabel(t.unit_id) : 'Unassigned'} />
                </div>
                {(t.lease_start || t.lease_end) && (
                  <p className="mb-4 text-xs text-[var(--text-muted)]">
                    Lease: {formatDate(t.lease_start)} → {formatDate(t.lease_end)}
                  </p>
                )}
                <div className="flex items-center justify-end gap-1.5 border-t border-[var(--border-light)] pt-3">
                  <button
                    onClick={() => openEdit(t)}
                    aria-label={`Edit ${t.full_name}`}
                    className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(t)}
                    aria-label={`Delete ${t.full_name}`}
                    className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} total={filtered.length} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete tenant?"
        message={deleteTarget ? `${deleteTarget.full_name} will be removed. Their payments will be deleted.` : ''}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        danger
        onConfirm={onConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
