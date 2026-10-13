import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import Payments from './Payments';

vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ limit: async () => ({ data: [], error: null }) }), insert: async () => ({ error: null }) }) },
}));

afterEach(cleanup);

describe('Payments', () => {
  it('disables submit when amount is invalid', async () => {
    render(<Payments />);
    expect(await screen.findByText(/ledger/i)).toBeTruthy();
    const btn = screen.getByRole('button', { name: /record payment/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '-5' } });
    expect((screen.getByRole('button', { name: /record payment/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
