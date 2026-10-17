export function formatCurrency(amount: number | string | undefined): string {
  if (amount === undefined || amount === null) return "₱0.00";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(amount));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-600",
    vacant: "bg-blue-100 text-blue-800",
    occupied: "bg-green-100 text-green-800",
    maintenance: "bg-yellow-100 text-yellow-800",
    open: "bg-blue-100 text-blue-800",
    in_progress: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    paid: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    overdue: "bg-red-100 text-red-800",
    low: "bg-gray-100 text-gray-600",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
    // Unit sales & buyer financing
    reserved: "bg-yellow-100 text-yellow-800",
    equity_paying: "bg-blue-100 text-blue-800",
    financing_pending: "bg-yellow-100 text-yellow-800",
    financing_approved: "bg-green-100 text-green-800",
    fully_paid: "bg-green-100 text-green-800",
    turned_over: "bg-emerald-100 text-emerald-800",
    draft: "bg-gray-100 text-gray-600",
    published: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-600",
    submitted: "bg-blue-100 text-blue-800",
    under_review: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    disapproved: "bg-red-100 text-red-800",
    partial: "bg-yellow-100 text-yellow-800",
    late: "bg-red-100 text-red-800",
    waived: "bg-gray-100 text-gray-600",
  };
  return map[status?.toLowerCase()] || "bg-gray-100 text-gray-600";
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
