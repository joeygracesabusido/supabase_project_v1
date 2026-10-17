interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  color?: string;
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  color = "text-[#003580]",
}: StatCardProps) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-5 hover:shadow-[var(--shadow-md)] transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-[var(--text-muted)] mt-1">{sub}</p>}
        </div>
        {icon && (
          <div className="p-2.5 rounded-xl bg-[var(--bg-muted)] text-[var(--text-secondary)]">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
