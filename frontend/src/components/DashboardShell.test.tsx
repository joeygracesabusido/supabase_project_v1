import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import DashboardShell from './DashboardShell';

afterEach(cleanup);

describe('DashboardShell', () => {
  it('switches tabs', () => {
    render(<DashboardShell />);
    expect(screen.getByTestId('tab-overview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /payments/i }));
    expect(screen.getByTestId('tab-payments')).toBeTruthy();
  });
});
