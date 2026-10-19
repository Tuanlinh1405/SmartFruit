import { useEffect, useState, type PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../features/auth/AuthProvider';
import { ADemoProvider } from '../features/a-demo/demo-context';
import { FarmerAssistantProvider } from '../features/farmer/assistant/assistant-context';
export function SessionWorkspace({ children }: PropsWithChildren) {
  const { session, profile, status } = useAuth();
  const identity = `${session?.user.id ?? 'anonymous'}:${profile?.role ?? status}`;
  return <ForIdentity key={identity} identity={identity}>{children}</ForIdentity>;
}
function ForIdentity({ children, identity }: PropsWithChildren<{ identity: string }>) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => { void client.cancelQueries(); client.clear(); }, [client]);
  return <QueryClientProvider client={client}><FarmerAssistantProvider><ADemoProvider identity={identity}>{children}</ADemoProvider></FarmerAssistantProvider></QueryClientProvider>;
}
