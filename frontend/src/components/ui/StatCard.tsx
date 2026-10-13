interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  color?: string;
}

export function StatCard({ label, value, sub, icon, color = 'text-[#003580]' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 transition-shadow hover:shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-[var(--text-muted)]">{sub}</p>}
        </div>
        {icon && (
          <div className="rounded-xl bg-[var(--bg-muted)] p-2.5 text-[var(--text-secondary)]">{icon}</div>
        )}
      </div>
    </div>
  );
}
