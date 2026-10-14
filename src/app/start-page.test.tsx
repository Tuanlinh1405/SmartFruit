import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AppProviders } from './providers';
import { AppRouter } from './router';

test('boots the app without Supabase configuration', () => {
  render(<AppProviders><AppRouter /></AppProviders>);
  expect(screen.getByRole('heading', { name: 'LogStar' })).toBeVisible();
  expect(screen.getByText('Nền dự án đã sẵn sàng.')).toBeVisible();
});
