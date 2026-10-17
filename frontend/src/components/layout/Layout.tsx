import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--bg-page)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 overflow-auto">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 bg-[var(--bg-card)] border-b border-[var(--border-color)] lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="flex-1 relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg-muted)] border-0 rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#003580]/20"
              />
            </div>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
