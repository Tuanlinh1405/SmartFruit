import { Link, Outlet } from 'react-router-dom';
import { Brand } from '../components/shared/brand';
export function AuthLayout() { return <main className="auth-layout stack"><Link className="brand" to="/"><Brand /></Link><Outlet /></main>; }
