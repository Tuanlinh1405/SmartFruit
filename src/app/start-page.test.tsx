import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AppProviders } from './providers';
import { AppRouter } from './router';
test('public landing boots without Supabase configuration or a role selector', () => {
  render(<AppProviders><AppRouter /></AppProviders>);
  expect(screen.getByRole('heading', { name: 'Nhà vườn, thu mua và vận tải' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login');
  expect(screen.queryByRole('link', { name: /^Mở khu vực/ })).not.toBeInTheDocument();
});
