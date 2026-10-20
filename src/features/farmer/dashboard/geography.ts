import { provinceIds } from './province-ids';
export interface Place { id: number; name: string; latitude: number; longitude: number; representative: boolean; administrative?: boolean; }
type GeoRow = { id?: unknown; name?: unknown; latitude?: unknown; longitude?: unknown; country_code?: unknown; feature_code?: unknown; admin1?: unknown; admin1_id?: unknown; };
export const normalizeProvince = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim().replace(/^(tinh|thanh pho|tp[.]?)\s+/,'').trim().replace(/\s+/g, ' ');
export function coordinates(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}
const memory = new Map<string, { until: number; places: Place[] }>();
export function administrativePlaces(rows: GeoRow[], name: string): Place[] {
  const unique = new Map<number, Place>();
  for (const row of rows) if (row.country_code === 'VN' && row.feature_code === 'ADM1' && typeof row.id === 'number' && typeof row.name === 'string' &&
    normalizeProvince(row.name) === normalizeProvince(name) && coordinates(row.latitude, row.longitude)) {
    unique.set(row.id, { id: row.id, name: row.name, latitude: row.latitude as number, longitude: row.longitude as number, representative: true, administrative: true });
  }
  return [...unique.values()];
}
export async function findPlaces(name: string, signal?: AbortSignal): Promise<Place[]> {
  const key = 'smartfruit-geocoding-v1:' + normalizeProvince(name);
  if (name.trim().length < 2) return [];
  let cached = memory.get(key);
  if (!cached) try { cached = JSON.parse(localStorage.getItem(key) || 'null') ?? undefined; } catch { /* storage optional */ }
  if (cached && cached.until > Date.now() && Array.isArray(cached.places) && cached.places.every(p => p && typeof p.name === 'string' && coordinates(p.latitude,p.longitude))) return cached.places;
  const requestSignal=signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);
  const normalized=normalizeProvince(name);const id=Object.hasOwn(provinceIds,normalized)?provinceIds[normalized]:undefined;
  if (id) {
    const r=await fetch(`https://geocoding-api.open-meteo.com/v1/get?id=${id}&language=vi`,{signal:requestSignal});
    if (!r.ok) throw new Error('Không tải được vị trí tỉnh. Vui lòng thử lại.');
    const exact=administrativePlaces([await r.json()],name);
    if(exact.length===1){const value={until:Date.now()+24*60*60_000,places:exact};memory.set(key,value);try{localStorage.setItem(key,JSON.stringify(value));}catch{/* optional */}return exact;}
  }
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: name.trim(), countryCode: 'VN', count: '100', language: 'vi' }).toString();
  const response = await fetch(url, { signal: requestSignal });
  if (!response.ok) throw new Error('Không tìm được địa điểm. Vui lòng thử lại.');
  const payload = await response.json();
  if (payload.results != null && !Array.isArray(payload.results)) throw new Error('Dữ liệu địa điểm chưa hợp lệ.');
  const rows = (payload.results ?? []).filter((r:unknown)=>r!==null&&typeof r==='object') as GeoRow[];
  const exact = administrativePlaces(rows, name);
  // Non-exact results are offered for explicit user selection only, never automatic placement.
  const places = exact.length ? exact : rows.filter(r => r.country_code === 'VN' && typeof r.id === 'number' && typeof r.name === 'string' && coordinates(r.latitude,r.longitude))
    .map(r => ({ id: r.id as number, name: [r.name, r.admin1].filter(Boolean).join(', '), latitude: r.latitude as number, longitude: r.longitude as number, representative: true }));
  const value = { until: Date.now() + 24 * 60 * 60_000, places };
  memory.set(key, value); try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage optional */ }
  return places;
}
export async function provincePlace(name: string, signal?: AbortSignal): Promise<Place | null> {
  const places = await findPlaces(name, signal);
  // Exact ADM1 candidates retain an exact name. Search fallback names include their administrative area.
  const exact = places.filter(p => p.administrative === true && normalizeProvince(p.name) === normalizeProvince(name));
  return exact.length === 1 ? exact[0] : null;
}
