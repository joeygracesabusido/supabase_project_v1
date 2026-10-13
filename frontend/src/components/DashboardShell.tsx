import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { Tab } from '../lib/types';
import Overview from './Overview';
import Properties from './Properties';
import Units from './Units';
import Payments from './Payments';
import { PageHeader } from './ui/PageHeader';
import { useTheme } from './ui/ThemeProvider';

const tabs: { id: Tab; label: string; path: string; subtitle: string }[] = [
  { id: 'overview', label: 'Overview', path: '/', subtitle: 'Portfolio performance at a glance' },
  { id: 'properties', label: 'Properties', path: '/properties', subtitle: 'Manage your buildings and addresses' },
  { id: 'units', label: 'Units', path: '/units', subtitle: 'Track rents and vacancies per unit' },
  { id: 'payments', label: 'Payments', path: '/payments', subtitle: 'Record and review rent inflows' },
];

export default function DashboardShell() {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const active = tabs.find((t) => t.path === pathname) ?? tabs[0];
  return (
    <div className="flex min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      <aside className="w-48 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] p-4">
        <p className="mb-4 text-sm font-bold tracking-tight text-[var(--text-primary)]">Property Manager</p>
        <nav className="space-y-1">
          {tabs.map((t) => (
            <NavLink
              key={t.id}
              to={t.path}
              className={({ isActive }) =>
                `block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  isActive
                    ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
                    : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)]'
                }`
              }
            >
              {t.label}
            </NavLink>
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
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/units" element={<Units />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/overview" element={<Navigate to="/" replace />} />
          <Route path="/property" element={<Navigate to="/properties" replace />} />
          <Route path="/unit" element={<Navigate to="/units" replace />} />
          <Route path="/payment" element={<Navigate to="/payments" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </section>
    </div>
  );
}
