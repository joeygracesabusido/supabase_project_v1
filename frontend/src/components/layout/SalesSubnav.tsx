// client-src/src/components/layout/SalesSubnav.tsx
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Handshake, ChevronDown } from "lucide-react";

// Ported Sales & Financing pages only — the customers CRM, loans dashboard,
// penalties/adjustments/restructuring admin and reports stay unported.
const GROUPS = [
  { title: "Pipeline", items: [{ to: "/sales", label: "Sales Applications" }] },
  { title: "Ledger", items: [
    { to: "/item-financing", label: "Item Financing" },
    { to: "/item-financing/payments", label: "IF Payments" },
  ]},
];

export function SalesSubnav({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const location = useLocation();
  const active = location.pathname.startsWith("/sales");
  const [open, setOpen] = useState(active);
  return (
    <div>
      <button onClick={() => { setOpen(!open); onClose?.(); }} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full ${active ? "bg-[#003580] text-white" : "text-[var(--text-sidebar)]"}`}>
        <Handshake size={18} />{!collapsed && <><span className="flex-1 text-left">Sales & Financing</span><ChevronDown size={14} className={open ? "rotate-180" : ""} /></>}
      </button>
      {open && !collapsed && GROUPS.map(g => (
        <div key={g.title}>
          <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{g.title}</p>
          {g.items.map(i => (
            <NavLink key={i.to} to={i.to} end={i.to === "/sales"} onClick={onClose} className={({ isActive }) => `block ml-6 px-3 py-2 rounded-lg text-sm ${isActive ? "bg-[#003580]/10 text-[#003580] font-semibold" : "text-[var(--text-sidebar)]"}`}>{i.label}</NavLink>
          ))}
        </div>
      ))}
    </div>
  );
}
