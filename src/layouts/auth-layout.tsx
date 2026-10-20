import { Link, Outlet } from 'react-router-dom';
import { BrandMark } from '../components/brand-mark';
export function AuthLayout() { return <main className="auth-layout stack"><Link className="brand" to="/"><BrandMark />onlmallfruit</Link><Outlet /></main>; }
