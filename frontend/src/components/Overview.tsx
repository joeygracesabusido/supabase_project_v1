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
