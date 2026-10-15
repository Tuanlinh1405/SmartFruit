import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';
import { ToastProvider } from '../components/ui/toast';
import { ADemoProvider } from '../features/a-demo/demo-context';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><ToastProvider><ADemoProvider>{children}</ADemoProvider></ToastProvider></QueryClientProvider>;
}
