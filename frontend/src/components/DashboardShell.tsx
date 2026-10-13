import { useState } from 'react';
import type { Tab } from '../lib/types';
import Overview from './Overview';
import Properties from './Properties';
import Units from './Units';
import Payments from './Payments';

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
        {tab === 'overview' && <Overview />}
        {tab === 'properties' && <Properties />}
        {tab === 'units' && <Units />}
        {tab === 'payments' && <Payments />}
      </section>
    </div>
  );
}
