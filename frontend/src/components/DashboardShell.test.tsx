import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
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
    render(
      <MemoryRouter>
        <DashboardShell />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /overview/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: /payments/i }));
    expect(await screen.findByText(/ledger/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: /overview/i }));
    expect((await screen.findAllByText(/occupancy/i)).length).toBeGreaterThanOrEqual(1);
  });
});
