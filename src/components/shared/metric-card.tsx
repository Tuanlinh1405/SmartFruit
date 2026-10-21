import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
export function MetricCard({label,value,description,icon:Icon,to}:{label:string;value:number;description?:string;icon?:LucideIcon;to?:string}) {
  const content=<>{Icon&&<span className="metric-icon"><Icon size={18} aria-hidden="true"/></span>}<h2>{label}</h2><strong>{new Intl.NumberFormat('vi-VN').format(value)}</strong>{description&&<small>{description}</small>}</>;
  return to?<Link className="stat-card metric-card" to={to}>{content}</Link>:<section className="stat-card metric-card">{content}</section>;
}
