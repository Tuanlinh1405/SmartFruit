import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AppProviders } from './providers';
import { AppRouter } from './router';
test('public landing boots without Supabase configuration and exposes four demo buttons', () => {
  render(<AppProviders><AppRouter /></AppProviders>);
  expect(screen.getByRole('heading', { name: 'Thuận mua. Vừa bán. Vận chuyển tối ưu.' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login');
  expect(screen.getAllByRole('button', { name: /^Demo / })).toHaveLength(4);
  expect(document.querySelector('.start-hero-background')).toHaveAttribute('src','/images/orchard-harvest.png');
});
