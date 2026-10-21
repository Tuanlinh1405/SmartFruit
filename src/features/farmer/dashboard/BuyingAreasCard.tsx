import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { groupAreas, loadAreaRequests } from './areas';
import { provincePlace, type Place } from './geography';
import { formatDate, formatMoney } from '../../../lib/format';
const AreaMap=lazy(()=>import('./AreaMap'));
export function BuyingAreasCard({ userId }: {userId:string}) {
  const [fruit,setFruit]=useState(''),[province,setProvince]=useState(''),[showMap,setShowMap]=useState(true),[places,setPlaces]=useState<Record<string,Place>>({}),[locating,setLocating]=useState(false);
  const requests=useQuery({queryKey:['buying-areas',userId],enabled:!!userId,queryFn:({signal})=>loadAreaRequests(signal),staleTime:60_000,retry:false,refetchOnWindowFocus:false});
  const catalog=useQuery({queryKey:['area-fruits',userId],queryFn:async()=>{const r=await supabase.from('fruit_types').select('id,name').order('name');if(r.error)throw r.error;return r.data;},retry:false});
  const areas=useMemo(()=>groupAreas((requests.data?.requests??[]).filter(r=>!fruit||r.fruit_type_id===fruit)),[requests.data,fruit]);
  const visible=useMemo(()=>areas.filter(a=>!province||a.key===province),[areas,province]);
  const selectArea=useCallback((key:string)=>setProvince(key),[]);
  useEffect(()=>{const controller=new AbortController();setPlaces({});if(!areas.length){setLocating(false);return;}setLocating(true);
    // Limit concurrent geocoding, and keep every unknown region in the list.
    let next=0;const resolved:Record<string,Place>={};
    const worker=async()=>{while(next<areas.length&&!controller.signal.aborted){const area=areas[next++];if(area.key==='__all__')continue;try{const p=await provincePlace(area.name,controller.signal);if(p)resolved[area.key]=p;}catch{/* list remains available */}}};
    void Promise.all([worker(),worker(),worker()]).then(()=>{if(!controller.signal.aborted){setPlaces(resolved);setLocating(false);}});
    return()=>controller.abort();
  },[areas]);
  return <section className="panel farmer-buying-areas" aria-label="Khu vực thu mua"><h2>Khu vực thu mua</h2><p>Nhu cầu đang mở, chưa hết hạn từ Buyer trên hệ thống.</p>
    <div className="row"><label>Loại quả khu vực<select className="control" value={fruit} onChange={e=>{setFruit(e.target.value);setProvince('');}}><option value="">Tất cả loại quả</option>{catalog.data?.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label>Tỉnh thu mua<select className="control" value={province} onChange={e=>setProvince(e.target.value)}><option value="">Tất cả khu vực</option>{areas.map(a=><option key={a.key} value={a.key}>{a.name}</option>)}</select></label>
      <button className="button outline" onClick={()=>setShowMap(!showMap)}>{showMap?'Chỉ xem danh sách':'Xem bản đồ'}</button>
      <button className="button outline" disabled={requests.isFetching} onClick={()=>void requests.refetch()}>Tải lại khu vực</button></div>
    {requests.isPending?<p role="status">Đang tải nhu cầu thu mua…</p>:requests.isError?<p role="alert">Không tải được khu vực thu mua. Hãy thử tải lại.</p>:<>
      <p>{new Set(visible.flatMap(a=>a.requests.map(r=>r.id))).size} nhu cầu riêng biệt · {visible.length} khu vực</p>
      {requests.data.truncated&&<p role="status">Chỉ hiển thị 1.000 nhu cầu đầu tiên. Đây chưa phải toàn bộ dữ liệu.</p>}
      {catalog.isError&&<p role="status">Không tải được tên loại quả. Danh sách nhu cầu vẫn hiển thị.</p>}
      {showMap&&<Suspense fallback={<p>Đang tải bản đồ…</p>}><AreaMap areas={visible} places={places} onSelect={selectArea}/></Suspense>}
      {locating&&<p role="status">Đang xác định điểm đại diện các tỉnh…</p>}
      <p className="muted">Điểm trên bản đồ đại diện khu vực khai báo, không phải vị trí kho/thương lái. Địa danh không tự chuyển sang tên tỉnh mới.</p>
      {!locating&&visible.length>0&&!visible.some(a=>places[a.key])&&<p role="status">Chưa có khu vực xác định được tọa độ hợp lệ; xem nhu cầu trong danh sách bên dưới.</p>}
      <small>Địa danh: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> / <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">Open-Meteo</a>.</small>
      {!visible.length&&<p>Chưa có nhu cầu thu mua phù hợp.</p>}
      <div className="buying-area-list">{visible.map(area=><article key={area.key}><h3>{area.name}</h3><p>{area.requests.length} nhu cầu{area.key!=='__all__'&&!places[area.key]&&!locating?' · Chưa xác định được điểm đại diện':''}</p>
        {area.requests.map(r=><div key={r.id} className="buying-request"><strong>{r.title}</strong><p>{catalog.data?.find(f=>f.id===r.fruit_type_id)?.name??'Nông sản'} · {Number(r.target_quantity_kg).toLocaleString('vi-VN')} kg</p><p>{formatMoney(Number(r.min_price_vnd_per_kg))} – {formatMoney(Number(r.max_price_vnd_per_kg))}</p><small>{formatDate(r.required_start)} → {formatDate(r.required_end)}</small></div>)}
      </article>)}</div>
    </>}
  </section>;
}
