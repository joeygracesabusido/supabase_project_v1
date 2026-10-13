import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import Tenants from './Tenants';

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

describe('Tenants', () => {
  it('shows the empty state when there are no tenants', async () => {
    render(<Tenants />);
    expect(await screen.findByText(/no tenants yet/i)).toBeTruthy();
    expect(screen.getByLabelText(/search tenants/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /add tenant/i })).toBeTruthy();
  });
});
