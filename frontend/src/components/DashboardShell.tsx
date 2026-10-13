import { useState } from 'react';
import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { Tab } from '../lib/types';
import Overview from './Overview';
import Properties from './Properties';
import Units from './Units';
import Tenants from './Tenants';
import Payments from './Payments';
import { PageHeader } from './ui/PageHeader';
import { useTheme } from './ui/ThemeProvider';

const groups: { heading: string; tabs: { id: Tab; label: string; path: string; subtitle: string }[] }[] = [
  {
    heading: 'Portfolio',
    tabs: [
      { id: 'overview', label: 'Overview', path: '/', subtitle: 'Portfolio performance at a glance' },
      { id: 'properties', label: 'Properties', path: '/properties', subtitle: 'Manage your buildings and addresses' },
      { id: 'units', label: 'Units', path: '/units', subtitle: 'Track rents and vacancies per unit' },
    ],
  },
  {
    heading: 'Management',
    tabs: [
      { id: 'tenants', label: 'Tenants', path: '/tenants', subtitle: 'Occupants, leases, and assignments' },
      { id: 'payments', label: 'Payments', path: '/payments', subtitle: 'Record and review rent inflows' },
    ],
  },
];

const allTabs = groups.flatMap((g) => g.tabs);

// Sidebar layout adapted from el-property Sidebar: grouped nav, collapsible
// on desktop, drawer + overlay on mobile. No icon dependency — text labels.
export default function DashboardShell() {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = allTabs.find((t) => t.path === pathname) ?? allTabs[0];

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-4">
        {!collapsed && (
          <p className="text-sm font-bold tracking-tight text-[var(--text-primary)]">Property Manager</p>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)] lg:block"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}>
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-sidebar-hover)] lg:hidden"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {groups.map((g) => (
          <div key={g.heading}>
            {!collapsed && (
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {g.heading}
              </p>
            )}
            <div className="space-y-1">
              {g.tabs.map((t) => (
                <NavLink
                  key={t.id}
                  to={t.path}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? t.label : undefined}
                  className={({ isActive }) =>
                    `block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      isActive
                        ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
                        : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)]'
                    } ${collapsed ? 'px-2 text-center' : ''}`
                  }
                >
                  {collapsed ? t.label.charAt(0) : t.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-[var(--border-color)] px-2 py-3">
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="w-full rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
        >
          {collapsed ? (theme === 'dark' ? '☾' : '☀') : theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      <aside className={`hidden shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:block ${collapsed ? 'w-[72px]' : 'w-48'}`}>
        {nav}
      </aside>
      {mobileOpen && (
        <>
          <div aria-hidden className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-64 border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:hidden">
            {nav}
          </div>
        </>
      )}
      <section className="flex-1 p-6">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="mb-4 rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] lg:hidden"
        >
          Menu
        </button>
        <PageHeader title={active.label} subtitle={active.subtitle} />
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/units" element={<Units />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/overview" element={<Navigate to="/" replace />} />
          <Route path="/property" element={<Navigate to="/properties" replace />} />
          <Route path="/unit" element={<Navigate to="/units" replace />} />
          <Route path="/tenant" element={<Navigate to="/tenants" replace />} />
          <Route path="/payment" element={<Navigate to="/payments" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </section>
    </div>
  );
}
