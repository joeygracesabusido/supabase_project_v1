// server/src/services/loan-ledger.service.ts
export const ALLOCATION_ORDER_DEFAULT = ["penalty","charges","interest","principal"] as const;

export function buildLoanNo(saleId: number, takeoutYear: number): string {
  return `LN-${takeoutYear}-${String(saleId).padStart(4, "0")}`;
}

export function allocatePayment(
  amount: number,
  buckets: { penalty: number; charges: number; interest: number; principal: number },
  order: string[] = [...ALLOCATION_ORDER_DEFAULT],
): { penalty: number; charges: number; interest: number; principal: number; unapplied: number } {
  const out = { penalty: 0, charges: 0, interest: 0, principal: 0 };
  let left = Math.round(amount * 100) / 100;
  for (const key of order) {
    const k = key as keyof typeof out;
    const owed = buckets[k] ?? 0;
    const take = Math.min(Math.max(owed, 0), Math.max(left, 0));
    out[k] = Math.round(take * 100) / 100;
    left = Math.round((left - take) * 100) / 100;
  }
  return { ...out, unapplied: left };
}

export function computeDelinquency(dueDate: Date, today: Date, status: string): { daysOverdue: number; isOverdue: boolean } {
  if (status === "paid") return { daysOverdue: 0, isOverdue: false };
  const ms = today.getTime() - dueDate.getTime();
  const days = Math.floor(ms / 86400000);
  return days > 0 ? { daysOverdue: days, isOverdue: true } : { daysOverdue: 0, isOverdue: false };
}

// Vendored from server/src/services/penalty.service.ts (ledger math, one home).
export type PenaltyMethod = "fixed" | "percent" | "daily" | "monthly";
export function calcPenalty(
  method: PenaltyMethod,
  base: number,
  rate: number,
  daysOverdue: number,
  graceDays = 0,
): number {
  const d = Math.max(0, daysOverdue - graceDays);
  if (d <= 0) return 0;
  if (method === "fixed") return Math.round(rate * 100) / 100;
  if (method === "percent") return Math.round(base * rate * 100) / 100;
  if (method === "daily") return Math.round(base * rate * d * 100) / 100;
  const months = Math.ceil(d / 30);
  return Math.round(base * rate * months * 100) / 100;
}
