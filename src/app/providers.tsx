import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';
import { ToastProvider } from '../components/ui/toast';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><ToastProvider>{children}</ToastProvider></QueryClientProvider>;
}
