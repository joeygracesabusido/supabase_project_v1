import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import DashboardShell from './DashboardShell';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ limit: async () => ({ data: [], error: null }) }),
      insert: async () => ({ error: null }),
      delete: () => ({ eq: async () => ({ error: null }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));

afterEach(cleanup);

describe('DashboardShell', () => {
  it('switches tabs', async () => {
    render(<DashboardShell />);
    expect(screen.getByRole('button', { name: /overview/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /payments/i }));
    expect(await screen.findByText(/ledger/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /overview/i }));
    expect((await screen.findAllByText(/occupancy/i)).length).toBeGreaterThanOrEqual(1);
  });
});
