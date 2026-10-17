import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { Fragment, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  LogOut,
  Home,
  Megaphone,
  X,
  Moon,
  Sun,
  ChevronLeft,
  FileText,
  Inbox,
  ClipboardCheck,
  Wrench,
  UserCheck,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { clearSession, getCurrentUser } from "../../lib/auth";
import { logout } from "../../api/auth";
import { useTheme } from "../ui/ThemeProvider";
import { SalesSubnav } from "./SalesSubnav";
import { WaterSubnav } from "./WaterSubnav";

const nav: { to: string; label: string; icon: LucideIcon; roles?: string[] }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/units", label: "Units", icon: Home },
  { to: "/listings", label: "Listings", icon: Megaphone },
  { to: "/tenants", label: "Tenants", icon: Users },
  { to: "/leases", label: "Leases", icon: FileText },
  { to: "/applications", label: "Applications", icon: Inbox },
  { to: "/inspections", label: "Inspections", icon: ClipboardCheck },
  { to: "/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/billing", label: "Billing", icon: CreditCard },
  // Role-gated (el Sidebar roles field)
  { to: "/approvals", label: "Approvals", icon: UserCheck, roles: ["admin", "manager"] },
  { to: "/users", label: "Staff & Admins", icon: ShieldCheck, roles: ["admin"] },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ name?: string; email?: string; role?: string }>({});

  useState(() => {
    getCurrentUser().then(setUser).catch(() => {});
  });

  async function handleLogout() {
    await logout();
    await clearSession();
    navigate("/login");
  }

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const sidebarWidth = collapsed ? "w-[72px]" : "w-64";

  const sidebarContent = (
    <aside
      className={`${sidebarWidth} min-h-screen bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col transition-all duration-200`}
    >
      {/* Logo */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-[var(--border-color)]">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#003580] flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-[var(--text-primary)] leading-tight">
                IJE Property
              </p>
              <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                Management System
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-[#003580] flex items-center justify-center mx-auto">
            <Building2 size={18} className="text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)] transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            size={16}
            className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-sidebar-hover)]"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Main Menu
          </p>
        )}
        {nav
          .filter((item) => !item.roles || (user.role && item.roles.includes(user.role)))
          .map(({ to, label, icon: Icon }) => (
          <Fragment key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive(to)
                  ? "bg-[#003580] text-white shadow-sm"
                  : "text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)]"
              } ${collapsed ? "justify-center px-2" : ""}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={isActive(to) ? 2.5 : 2} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          </Fragment>
        ))}

        <SalesSubnav collapsed={collapsed} onClose={onClose} />
        <WaterSubnav collapsed={collapsed} onClose={onClose} />
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-3 border-t border-[var(--border-color)] space-y-0.5">
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)] transition-colors ${collapsed ? "justify-center px-2" : ""}`}
          title={collapsed ? (theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-sidebar)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 transition-colors ${collapsed ? "justify-center px-2" : ""}`}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign Out</span>}
        </button>

        {/* User card */}
        {!collapsed && user.name && (
          <div className="mt-2 px-3 py-2.5 rounded-lg bg-[var(--bg-muted)] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#003580] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] truncate capitalize">
                {user.role}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">{sidebarContent}</div>

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
