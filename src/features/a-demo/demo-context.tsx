import { Fragment, createContext, useContext, useState, type PropsWithChildren } from 'react';
import { initialDemoState, type ADemoState } from '../../mocks/a-demo';
const DemoContext = createContext<{ state: ADemoState; update: (fn: (previous: ADemoState) => ADemoState) => void; reset: () => void } | null>(null);
export function ADemoProvider({ children, identity = 'public-demo' }: PropsWithChildren<{ identity?: string }>) { return <ForIdentity key={identity}>{children}</ForIdentity>; }
function ForIdentity({ children }: PropsWithChildren) {
  const [state, setState] = useState(initialDemoState);
  const [epoch, setEpoch] = useState(0);
  return <DemoContext.Provider value={{ state, update: setState, reset: () => { setState(initialDemoState()); setEpoch(value => value + 1); } }}><Fragment key={epoch}>{children}</Fragment></DemoContext.Provider>;
}
export function useADemo() { const value = useContext(DemoContext); if (!value) throw new Error('ADemoProvider required'); return value; }
