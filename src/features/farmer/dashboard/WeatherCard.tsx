import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../../lib/supabase';
import { coordinates, findPlaces, provincePlace, type Place } from './geography';
import { cachedForecast, loadForecast, weatherLabel, type Forecast } from './weather';

export function WeatherCard() {
  const { session } = useAuth(); const userId = session?.user.id;
  const [place, setPlace] = useState<Place | null>(null), [search, setSearch] = useState(''), [options,setOptions] = useState<Place[]>([]);
  const [locationError,setLocationError] = useState(''), [searching,setSearching] = useState(false), [chosen,setChosen] = useState(false);
  const profile = useQuery({ queryKey: ['weather-profile',userId], enabled: !!userId, retry: false, queryFn: async () => {
    const { data,error } = await supabase.from('farmer_profiles').select('farm_name,province,latitude,longitude').eq('user_id',userId!).maybeSingle(); if (error) throw error; return data;
  }});
  useEffect(() => {
    if (chosen || !profile.data) return;
    const p = profile.data; const controller = new AbortController();
    if (coordinates(p.latitude,p.longitude)) setPlace({ id: 0, name: p.farm_name, latitude: p.latitude, longitude: p.longitude, representative: false });
    else if (p.province) { setSearch(p.province); void provincePlace(p.province,controller.signal).then(found => { if (!controller.signal.aborted) { setPlace(found); if (!found) setLocationError('Chưa xác định duy nhất tỉnh trong hồ sơ. Hãy tìm và chọn địa điểm tham khảo.'); } }).catch(() => { if (!controller.signal.aborted) setLocationError('Không tìm được tỉnh trong hồ sơ. Hãy tìm địa điểm để thử lại.'); }); }
    return () => controller.abort();
  },[profile.data,chosen]);
  const forecast = useQuery({ queryKey: ['weather',place?.latitude,place?.longitude], queryFn: ({ signal }) => loadForecast(place!,signal), enabled: !!place, staleTime: 15 * 60_000, retry: false, refetchOnWindowFocus: false });
  const data: Forecast | undefined = forecast.data ?? (place ? cachedForecast(place) : undefined);
  return <section className="panel farmer-weather" aria-label="Thời tiết tại vườn"><h2>Thời tiết tại vườn</h2>
    {profile.isPending && <p role="status">Đang đọc vị trí hồ sơ…</p>}
    {profile.isError && <p role="alert">Không đọc được hồ sơ. Bạn vẫn có thể chọn địa điểm bên dưới. <button className="text-link" onClick={() => void profile.refetch()}>Thử lại hồ sơ</button></p>}
    {!profile.isPending && !place && <p>Chưa có vị trí dự báo. Chọn địa điểm tham khảo hoặc bổ sung tọa độ trong hồ sơ vườn.</p>}
    <form className="stack-sm" onSubmit={async e => { e.preventDefault(); if (searching) return; setSearching(true); setLocationError(''); setOptions([]); try { const rows=await findPlaces(search); setOptions(rows); if (!rows.length) setLocationError('Không tìm thấy địa điểm tại Việt Nam.'); } catch { setLocationError('Không tìm được địa điểm. Vui lòng thử lại.'); } finally { setSearching(false); } }}>
      <label>Tìm địa điểm thời tiết<input className="control" value={search} maxLength={120} onChange={e=>setSearch(e.target.value)} placeholder="Nhập tỉnh hoặc thành phố" /></label>
      <button className="button outline" disabled={searching || search.trim().length < 2}>{searching ? 'Đang tìm…' : 'Tìm địa điểm'}</button>
      {options.length > 0 && <label>Chọn địa điểm tham khảo<select className="control" value="" onChange={e=>{const p=options.find(x=>x.id===Number(e.target.value));if(p){setChosen(true);setPlace(p);setLocationError('');}}}><option value="">Chọn địa điểm</option>{options.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>}
    </form>
    {locationError && <p role="alert">{locationError}</p>}
    {place && <><p><strong>{place.name}</strong> · {place.representative ? 'Địa điểm đại diện' : 'Theo tọa độ hồ sơ vườn'}</p>
      {forecast.isFetching && <p role="status">Đang tải dự báo…</p>}
      {forecast.isError && <p role="alert">Không tải được dự báo mới.{data && ' Đang hiển thị dữ liệu cũ.'} <button className="text-link" onClick={()=>void forecast.refetch()}>Thử lại thời tiết</button></p>}
      {data && <><p className="weather-temperature">{data.temperature}°C · {weatherLabel(data.code)}</p><p>Độ ẩm {data.humidity}% · Gió {data.wind} km/h</p><p>Khả năng mưa hôm nay: {data.days[0].rain}%</p>
        <ul className="weather-days">{data.days.map(d=><li key={d.date}><strong>{d.date.split('-').reverse().join('/')}</strong><span>{weatherLabel(d.code)}</span><span>{d.min}–{d.max}°C · Mưa {d.rain}%</span></li>)}</ul>
        <small>Cập nhật {new Date(data.updatedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · Giờ Việt Nam</small></>}
    </>}
    <p className="muted"><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Nguồn: Open-Meteo</a> · Dự báo tham khảo, không phải số đo tại vườn.</p>
  </section>;
}
