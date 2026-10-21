import { supabase } from '../../../lib/supabase';
import { normalizeProvince } from './geography';
export interface AreaRequest { id: string; title: string; fruit_type_id: string; preferred_provinces: string[]; target_quantity_kg: number; min_price_vnd_per_kg: number; max_price_vnd_per_kg: number; required_start: string; required_end: string; }
export interface BuyingArea { key: string; name: string; requests: AreaRequest[]; }
export function vietnamDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export async function loadAreaRequests(signal?: AbortSignal) {
  const requests: AreaRequest[] = []; let truncated = false;
  for (let offset=0;offset<1000;offset+=100) {
    const { data,error,count } = await supabase.from('buy_requests').select('id,title,fruit_type_id,preferred_provinces,target_quantity_kg,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end',{count:'exact'})
      .eq('status','OPEN').gte('required_end',vietnamDate()).order('id').range(offset,offset+99).abortSignal(signal ?? new AbortController().signal);
    if (error || !data || count === null) throw new Error('Không tải được khu vực thu mua.');
    requests.push(...data as AreaRequest[]); truncated = count > 1000; if (offset+data.length >= count || data.length < 100) break;
  }
  return { requests, truncated };
}
export function groupAreas(requests: AreaRequest[]): BuyingArea[] {
  const groups = new Map<string, { name: string; requests: Map<string,AreaRequest> }>();
  for (const r of requests) {
    const names = (r.preferred_provinces ?? []).filter(n=>n.trim());
    for (const name of names.length ? names : ['']) {
      const key = normalizeProvince(name) || '__all__'; let area=groups.get(key);
      if(!area){area={name:name.trim()||'Không giới hạn khu vực',requests:new Map()};groups.set(key,area);} area.requests.set(r.id,r);
    }
  }
  return [...groups].map(([key,g])=>({key,name:g.name,requests:[...g.requests.values()]})).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
}
