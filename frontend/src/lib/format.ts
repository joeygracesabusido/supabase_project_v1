export function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '$0';
  const n = Number(amount);
  if (Number.isNaN(n)) return '$0';
  return `$${n.toLocaleString('en-US')}`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Ported from el-property client-src/src/lib/utils.ts so Badge/status pills
// share one color map. Extended with tenant/lease states used by Tenants.
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-600',
    vacant: 'bg-blue-100 text-blue-800',
    occupied: 'bg-green-100 text-green-800',
    maintenance: 'bg-yellow-100 text-yellow-800',
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800',
    cash: 'bg-emerald-100 text-emerald-800',
    gcash: 'bg-blue-100 text-blue-800',
    bank: 'bg-violet-100 text-violet-800',
    other: 'bg-gray-100 text-gray-600',
  };
  return map[status?.toLowerCase()] || 'bg-gray-100 text-gray-600';
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
