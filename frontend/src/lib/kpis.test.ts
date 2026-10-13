import { describe, it, expect } from 'vitest';
import { calcKpis, toMonthKey } from './kpis';

describe('calcKpis', () => {
  it('computes occupancy and collection', () => {
    const units = [
      { id: 'u1', property_id: 'p1', unit_number: '101', rent: 1000, status: 'occupied' as const },
      { id: 'u2', property_id: 'p1', unit_number: '102', rent: 2000, status: 'vacant' as const },
    ];
    const payments = [
      { id: 'pay1', tenant_id: 't1', unit_id: 'u1', amount: 1000, method: 'cash' as const, for_month: '2026-10-01', paid_on: '2026-10-02' },
    ];
    const k = calcKpis(units, payments, '2026-10-01');
    expect(k.totalUnits).toBe(2);
    expect(k.occupied).toBe(1);
    expect(k.vacant).toBe(1);
    expect(k.occupancyPct).toBe(50);
    expect(k.expected).toBe(3000);
    expect(k.collected).toBe(1000);
  });
  it('formats month key', () => {
    expect(toMonthKey(new Date('2026-10-15T00:00:00'))).toBe('2026-10-01');
  });
});
