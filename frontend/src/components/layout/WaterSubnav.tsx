// client-src/src/components/layout/WaterSubnav.tsx
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Droplets, ChevronDown, Receipt, Gauge, CreditCard, SlidersHorizontal } from "lucide-react";

export function WaterSubnav({
  collapsed,
  onClose,
}: {
  collapsed: boolean;
  onClose?: () => void;
}) {
  const location = useLocation();
  const isWaterRoute = location.pathname.startsWith("/water");
  const [open, setOpen] = useState(isWaterRoute);
  const [billsOpen, setBillsOpen] = useState(true);

  if (collapsed) {
    return (
      <NavLink
        to="/water/bills"
        onClick={onClose}
        className={`flex items-center justify-center px-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isWaterRoute
            ? "bg-[#003580] text-white shadow-sm"
            : "text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)]"
        }`}
        title="Water Transactions"
      >
        <Droplets size={18} strokeWidth={isWaterRoute ? 2.5 : 2} />
      </NavLink>
    );
  }

  return (
    <div className="space-y-0.5">
      {/* Main Water Transactions Toggle */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all ${
          isWaterRoute
            ? "bg-[#003580] text-white shadow-sm"
            : "text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)]"
        }`}
      >
        <Droplets size={18} strokeWidth={isWaterRoute ? 2.5 : 2} />
        <span className="flex-1 text-left">Water Transactions</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded Menu */}
      {open && (
        <div className="pl-3 pr-1 py-1 space-y-1">
          {/* Water Bills Dropdown */}
          <div className="rounded-lg bg-[var(--bg-sidebar-hover)]/40 p-1">
            <button
              type="button"
              onClick={() => setBillsOpen(!billsOpen)}
              className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)] transition-colors"
            >
              <span className="flex items-center gap-2">
                <Receipt size={14} className="text-[#003580]" />
                Water Bills
              </span>
              <ChevronDown
                size={12}
                className={`transition-transform duration-200 text-[var(--text-muted)] ${
                  billsOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {billsOpen && (
              <div className="mt-1 space-y-0.5 pl-2 border-l-2 border-[#003580]/20 ml-2">
                <NavLink
                  to="/water/bills"
                  end
                  onClick={onClose}
                  className={({ isActive }) =>
                    `block px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      isActive && !location.search
                        ? "bg-[#003580]/15 text-[#003580] font-semibold"
                        : "text-[var(--text-sidebar)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)]"
                    }`
                  }
                >
                  All Water Bills
                </NavLink>
                <NavLink
                  to="/water/bills?tab=bills&method=submeter"
                  onClick={onClose}
                  className={() =>
                    `block px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      location.pathname === "/water/bills" && location.search.includes("method=submeter")
                        ? "bg-[#003580]/15 text-[#003580] font-semibold"
                        : "text-[var(--text-sidebar)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)]"
                    }`
                  }
                >
                  Submeter Invoices
                </NavLink>
                <NavLink
                  to="/water/bills?tab=bills&method=rubs"
                  onClick={onClose}
                  className={() =>
                    `block px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      location.pathname === "/water/bills" && location.search.includes("method=rubs")
                        ? "bg-[#003580]/15 text-[#003580] font-semibold"
                        : "text-[var(--text-sidebar)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)]"
                    }`
                  }
                >
                  RUBS Ratio Split
                </NavLink>
                <NavLink
                  to="/water/bills?tab=bills&status=unpaid"
                  onClick={onClose}
                  className={() =>
                    `block px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      location.pathname === "/water/bills" && location.search.includes("status=unpaid")
                        ? "bg-[#003580]/15 text-[#003580] font-semibold"
                        : "text-[var(--text-sidebar)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)]"
                    }`
                  }
                >
                  Unpaid & Overdue
                </NavLink>
              </div>
            )}
          </div>

          {/* Meter Readings */}
          <NavLink
            to="/water/readings"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#003580]/15 text-[#003580] font-semibold"
                  : "text-[var(--text-sidebar)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)]"
              }`
            }
          >
            <Gauge size={14} className="text-[#003580]" />
            <span>Meter Readings</span>
          </NavLink>

          {/* Payment Transactions */}
          <NavLink
            to="/water/payments"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#003580]/15 text-[#003580] font-semibold"
                  : "text-[var(--text-sidebar)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)]"
              }`
            }
          >
            <CreditCard size={14} className="text-[#003580]" />
            <span>Water Payments</span>
          </NavLink>

          {/* Rates & Tariffs */}
          <NavLink
            to="/water/tariffs"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#003580]/15 text-[#003580] font-semibold"
                  : "text-[var(--text-sidebar)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)]"
              }`
            }
          >
            <SlidersHorizontal size={14} className="text-[#003580]" />
            <span>Rates & Tariffs</span>
          </NavLink>
        </div>
      )}
    </div>
  );
}
