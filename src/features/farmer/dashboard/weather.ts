import type { Place } from './geography';
export interface Forecast { temperature: number; humidity: number; wind: number; code: number; updatedAt: number; days: { date: string; min: number; max: number; rain: number; code: number }[]; }
const cache = new Map<string, Forecast>();
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export class WeatherServiceError extends Error { constructor(public status:number){super('Không tải được dự báo. Vui lòng thử lại.');} }
export function parseForecast(data: Record<string, any>): Forecast {
  const c = data.current, d = data.daily;
  if (data.timezone !== 'Asia/Ho_Chi_Minh' || !c || !d || ![c.temperature_2m,c.relative_humidity_2m,c.wind_speed_10m,c.weather_code].every(finite) ||
    !Array.isArray(d.time) || d.time.length < 3) throw new Error('Dữ liệu thời tiết chưa đầy đủ.');
  const days = d.time.slice(0,3).map((date: unknown, i: number) => {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || ![d.temperature_2m_min?.[i],d.temperature_2m_max?.[i],d.precipitation_probability_max?.[i],d.weather_code?.[i]].every(finite)) throw new Error('Dữ liệu dự báo chưa đầy đủ.');
    return { date, min: d.temperature_2m_min[i] as number, max: d.temperature_2m_max[i] as number, rain: d.precipitation_probability_max[i] as number, code: d.weather_code[i] as number };
  });
  return { temperature: c.temperature_2m, humidity: c.relative_humidity_2m, wind: c.wind_speed_10m, code: c.weather_code, updatedAt: Date.now(), days };
}
export const weatherKey = (p: Place) => `${p.latitude},${p.longitude}`;
export const cachedForecast = (p: Place) => cache.get(weatherKey(p));
export async function loadForecast(place: Place, signal?: AbortSignal): Promise<Forecast> {
  const previous = cachedForecast(place);
  if (previous && Date.now() - previous.updatedAt < 15 * 60_000) return previous;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', forecast_days: '3', timezone: 'Asia/Ho_Chi_Minh', wind_speed_unit: 'kmh', temperature_unit: 'celsius' }).toString();
  const r = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) });
  if (!r.ok) throw new WeatherServiceError(r.status);
  const data = parseForecast(await r.json()); cache.set(weatherKey(place), data); return data;
}
export function weatherLabel(code: number) {
  if (code === 0) return 'Trời quang'; if (code <= 3) return 'Có mây'; if (code === 45 || code === 48) return 'Sương mù';
  if (code >= 95) return 'Dông'; if (code >= 71 && code <= 77 || code === 85 || code === 86) return 'Tuyết';
  if (code >= 51 && code <= 67 || code >= 80 && code <= 82) return 'Mưa'; return 'Chưa phân loại';
}
