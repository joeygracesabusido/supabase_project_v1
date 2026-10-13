import type { Unit, Payment } from './types';

export function toMonthKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-01`;
}

export function calcKpis(units: Unit[], payments: Payment[], monthKey: string) {
  const totalUnits = units.length;
  const occupied = units.filter((u) => u.status === 'occupied').length;
  const vacant = totalUnits - occupied;
  const occupancyPct = totalUnits === 0 ? 0 : Math.round((occupied / totalUnits) * 100);
  const expected = units.reduce((s, u) => s + Number(u.rent), 0);
  const collected = payments
    .filter((p) => p.for_month.slice(0, 10) === monthKey)
    .reduce((s, p) => s + Number(p.amount), 0);
  const collectionRate = expected === 0 ? 0 : Math.round((collected / expected) * 100);
  return { totalUnits, occupied, vacant, occupancyPct, expected, collected, collectionRate };
}
