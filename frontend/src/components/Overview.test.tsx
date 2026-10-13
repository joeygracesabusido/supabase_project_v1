import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import Overview from './Overview';

vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ limit: async () => ({ data: [], error: null }) }) }) },
}));

afterEach(cleanup);

describe('Overview', () => {
  it('renders 4 KPI cards', async () => {
    render(<Overview />);
    const occ = await screen.findAllByText(/occupancy/i);
    expect(occ.length).toBeGreaterThanOrEqual(2);
    expect((await screen.findAllByText(/expected rent/i)).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText(/collected/i)).length).toBeGreaterThanOrEqual(2);
    expect((await screen.findAllByText(/vacant/i)).length).toBeGreaterThanOrEqual(1);
  });
});
