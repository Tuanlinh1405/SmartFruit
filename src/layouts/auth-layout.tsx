import { Link, Outlet } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { Leaf } from 'lucide-react';
export function AuthLayout({children}:PropsWithChildren) { return <main className="auth-layout stack"><Link className="brand" to="/"><Leaf size={28} aria-hidden="true" />SmartFruit</Link>{children ?? <Outlet />}</main>; }
