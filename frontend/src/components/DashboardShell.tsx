import { useState } from 'react';
import type { Tab } from '../lib/types';
import Overview from './Overview';
import Properties from './Properties';
import Units from './Units';
import Payments from './Payments';
import { PageHeader } from './ui/PageHeader';
import { useTheme } from './ui/ThemeProvider';

const tabs: { id: Tab; label: string; subtitle: string }[] = [
  { id: 'overview', label: 'Overview', subtitle: 'Portfolio performance at a glance' },
  { id: 'properties', label: 'Properties', subtitle: 'Manage your buildings and addresses' },
  { id: 'units', label: 'Units', subtitle: 'Track rents and vacancies per unit' },
  { id: 'payments', label: 'Payments', subtitle: 'Record and review rent inflows' },
];

export default function DashboardShell({ initialTab = 'overview' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { theme, toggle } = useTheme();
  const active = tabs.find((t) => t.id === tab)!;
  return (
    <div className="flex min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      <aside className="w-48 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] p-4">
        <p className="mb-4 text-sm font-bold tracking-tight text-[var(--text-primary)]">Property Manager</p>
        <nav className="space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
                  : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="mt-6 w-full rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </aside>
      <section className="flex-1 p-6">
        <PageHeader title={active.label} subtitle={active.subtitle} />
        {tab === 'overview' && <Overview />}
        {tab === 'properties' && <Properties />}
        {tab === 'units' && <Units />}
        {tab === 'payments' && <Payments />}
      </section>
    </div>
  );
}
