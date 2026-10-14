import { Link, Outlet } from 'react-router-dom';
export function AuthLayout() { return <main className="auth-layout stack"><Link className="brand" to="/">SmartFruit</Link><Outlet /></main>; }
