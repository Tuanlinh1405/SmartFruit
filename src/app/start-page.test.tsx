import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AppProviders } from './providers';
import { AppRouter } from './router';

test('boots the app without Supabase configuration', () => {
  render(<AppProviders><AppRouter /></AppProviders>);
  expect(screen.getByRole('heading', { name: 'Cùng một phong cách, bốn khu vực' })).toBeVisible();
  expect(screen.getAllByRole('link', { name: /^Mở khu vực/ })).toHaveLength(4);
});
