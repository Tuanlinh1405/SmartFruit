import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { explainError, formatTransportFare } from '../../lib/format';
import { vietnamDate } from '../farmer/dashboard/areas';
import { createTransport,findVehicles,listTransport,loadTransportSources,respondTransport,transportLabels,vehicleTypes,type Shipment,type TransportRequest,type VehicleType } from './api';
import './transport.css';

function RequestCard({row,carrier,busy,onAct}:{row:TransportRequest;carrier:boolean;busy:boolean;onAct:(id:string,decision:string,price?:number,note?:string)=>void}){
  const[price,setPrice]=useState(''),[note,setNote]=useState('');
  return <article className="panel transport-request" id={`transport-${row.id}`}>
    <h3>{row.source_title}</h3><p><strong>{transportLabels[row.status]}</strong> · {Number(row.quantity_kg).toLocaleString('vi-VN')} kg</p>
    <p>{row.origin_province} → {row.destination_province} · {row.pickup_date.split('-').reverse().join('/')}</p>
    <p>Lấy hàng: {row.origin_address}<br/>Giao hàng: {row.destination_address}</p>
    <p>{row.carrier_name} · {row.vehicle_label}</p><p><strong>{row.quote_vnd?formatTransportFare(row.quote_vnd):'Chờ báo giá'}</strong></p>{row.quote_note&&<p>{row.quote_note}</p>}
    {row.status==='ACCEPTED'&&<p className="muted">Hai bên đã thống nhất báo giá. Liên hệ xác nhận lịch xe; hệ thống chưa tự giữ chỗ hoặc xử lý thanh toán.</p>}
    {carrier&&row.status==='PENDING'&&<form className="stack-sm" onSubmit={e=>{e.preventDefault();onAct(row.id,'QUOTED',Number(price),note);}}>
      <label>Cước trọn chuyến (VND)<input className="control" type="number" min="1" max="1000000000000" step="1" required value={price} onChange={e=>setPrice(e.target.value)}/></label>
      <label>Ghi chú báo giá<textarea className="control" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></label>
      <div className="row"><button className="button primary" disabled={busy}>Xác nhận lịch và gửi báo giá</button><button type="button" className="button outline" disabled={busy} onClick={()=>onAct(row.id,'DECLINED')}>Từ chối</button></div>
    </form>}
    {!carrier&&row.status==='QUOTED'&&<button className="button primary" disabled={busy} onClick={()=>onAct(row.id,'ACCEPTED')}>Chấp nhận báo giá</button>}
    {!carrier&&['PENDING','QUOTED','ACCEPTED'].includes(row.status)&&<button className="button outline" disabled={busy} onClick={()=>onAct(row.id,'CANCELLED')}>Hủy yêu cầu</button>}
  </article>;
}

export function TransportPage(){
  const{session,profile}=useAuth();const userId=session?.user.id??'';const carrier=profile?.role==='CARRIER';const client=useQueryClient();const[params]=useSearchParams();
  const[page,setPage]=useState(1),[vehiclePage,setVehiclePage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const[sourceId,setSourceId]=useState(''),[kg,setKg]=useState(''),[destination,setDestination]=useState(''),[originDetail,setOriginDetail]=useState(''),[destinationDetail,setDestinationDetail]=useState(''),[pickup,setPickup]=useState(''),[required,setRequired]=useState<VehicleType>('ENCLOSED'),[minTemp,setMinTemp]=useState(''),[maxTemp,setMaxTemp]=useState('');
  const[search,setSearch]=useState<Shipment|null>(null);
  const sources=useQuery({queryKey:['transport-sources',userId],enabled:!!userId&&!carrier,retry:false,queryFn:loadTransportSources});
  const requests=useQuery({queryKey:['transport-requests',userId,page],enabled:!!userId,retry:false,queryFn:()=>listTransport(page)});
  const matches=useQuery({queryKey:['vehicle-matches',userId,search,vehiclePage],enabled:!!search,retry:false,queryFn:()=>findVehicles(search!,vehiclePage)});
  const source=sources.data?.find(s=>(s.agreement_id??s.lot_id)===sourceId);
  useEffect(()=>{if(!sources.data?.length)return;const s=sources.data.find(x=>x.lot_id===params.get('lotId')||x.agreement_id===params.get('agreementId'))??sources.data[0];setSourceId(s.agreement_id??s.lot_id);},[sources.data,params]);
  useEffect(()=>{if(source){setKg(String(source.quantity_kg));setPickup(source.available_start>vietnamDate()?source.available_start:vietnamDate());setSearch(null);}},[source]);
  // A notification may refer to an older request outside the current list page.
  const targetId=params.get('requestId');
  const target=useQuery({queryKey:['transport-request',userId,targetId],enabled:!!targetId&&!!userId,retry:false,queryFn:async()=>{const r=await supabase.from('transport_requests').select('*').eq('id',targetId!).maybeSingle();if(r.error)throw r.error;return r.data as TransportRequest|null;}});
  async function refresh(){await Promise.all([client.invalidateQueries({queryKey:['transport-requests',userId]}),client.invalidateQueries({queryKey:['transport-request',userId]}),client.invalidateQueries({queryKey:['transport-summary',userId]}),client.invalidateQueries({queryKey:['notifications',userId]})]);}
  async function act(id:string,decision:string,price?:number,note?:string){if(busy)return;setBusy(true);setError('');setSuccess('');try{await respondTransport(id,decision,price,note);await refresh();setSuccess('Đã cập nhật yêu cầu vận chuyển.');}catch(e){setError(explainError(e));}finally{setBusy(false);}}
  return <div className="stack transport-page"><header><h1>{carrier?'Yêu cầu vận chuyển':'Tìm xe phù hợp'}</h1><p>Ghép xe theo tải trọng, loại xe và vùng phục vụ. Cước do nhà xe báo theo chuyến.</p></header>
    {error&&<p role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
    {!carrier&&<section className="panel"><h2>Tìm xe cho nguồn hàng</h2>{sources.isPending?<p>Đang tải nguồn hàng…</p>:sources.isError?<p role="alert">Không tải được nguồn hàng. <button onClick={()=>void sources.refetch()}>Thử lại</button></p>:!sources.data.length?<p>Chưa có nguồn hàng có thể vận chuyển. Nhà vườn cần lô đang công bố; người mua cần thỏa thuận có ngày giao còn hiệu lực.</p>:<form className="transport-form" onChange={()=>setSearch(null)} onSubmit={e=>{e.preventDefault();if(!source)return;setError('');setVehiclePage(1);setSearch({target_lot_id:source.lot_id,target_agreement_id:source.agreement_id,kg:Number(kg),origin:source.province,destination:destination.trim(),origin_detail:originDetail.trim(),destination_detail:destinationDetail.trim(),pickup,required,temp_min:required==='REFRIGERATED'&&minTemp!==''?Number(minTemp):null,temp_max:required==='REFRIGERATED'&&maxTemp!==''?Number(maxTemp):null});}}>
      <label>Nguồn hàng<select className="control" value={sourceId} onChange={e=>setSourceId(e.target.value)}>{sources.data.map(s=><option key={s.agreement_id??s.lot_id} value={s.agreement_id??s.lot_id}>{s.title} · {Number(s.quantity_kg).toLocaleString('vi-VN')} kg</option>)}</select></label>
      <label>Khối lượng (kg)<input className="control" type="number" min="0.001" step="0.001" max={source?.quantity_kg} required value={kg} onChange={e=>setKg(e.target.value)}/></label>
      <label>Tỉnh lấy hàng<input className="control" readOnly value={source?.province??''}/></label>
      <label>Tỉnh giao hàng<input className="control" maxLength={120} required value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Ví dụ: Hồ Chí Minh"/></label>
      <label>Địa chỉ lấy hàng<input className="control" maxLength={500} required value={originDetail} onChange={e=>setOriginDetail(e.target.value)}/></label>
      <label>Địa chỉ giao hàng<input className="control" maxLength={500} required value={destinationDetail} onChange={e=>setDestinationDetail(e.target.value)}/></label>
      <label>Ngày lấy hàng<input className="control" type="date" required min={source&&source.available_start>vietnamDate()?source.available_start:vietnamDate()} max={source?.available_end} value={pickup} onChange={e=>setPickup(e.target.value)}/></label>
      <label>Loại xe<select className="control" value={required} onChange={e=>{setRequired(e.target.value as VehicleType);setMinTemp('');setMaxTemp('');}}>{Object.entries(vehicleTypes).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
      {required==='REFRIGERATED'&&<><label>Nhiệt độ thấp nhất (°C)<input className="control" type="number" min="-100" max="100" step="0.01" required value={minTemp} onChange={e=>setMinTemp(e.target.value)}/></label><label>Nhiệt độ cao nhất (°C)<input className="control" type="number" min={minTemp||'-100'} max="100" step="0.01" required value={maxTemp} onChange={e=>setMaxTemp(e.target.value)}/></label></>}
      <button className="button primary">Tìm xe</button><small>Hiển thị tối đa 200 nguồn hàng gần nhất còn hiệu lực. Tên tỉnh phải khớp vùng nhà xe đăng ký.</small>
    </form>}</section>}
    {search&&<section className="panel"><h2>Xe phù hợp</h2><p>{search.origin} → {search.destination} · {search.kg.toLocaleString('vi-VN')} kg · {search.pickup}</p>
      {matches.isPending?<p>Đang tìm xe…</p>:matches.isError?<p role="alert">Không tìm được xe. <button onClick={()=>void matches.refetch()}>Thử lại</button></p>:<>
        <p>{matches.data.count} xe phù hợp · Ưu tiên tải trọng vừa đủ</p>{!matches.data.items.length&&<p>Chưa có xe đáp ứng. Hãy kiểm tra vùng phục vụ, loại xe và nhiệt độ.</p>}
        <div className="transport-results">{matches.data.items.map(v=><article key={v.id}><h3>{v.company_name}</h3><p>{vehicleTypes[v.vehicle_type]} · {Number(v.capacity_kg).toLocaleString('vi-VN')} kg</p><p>Đủ tải · Đúng loại xe · Phục vụ cả nơi lấy và giao</p>{v.min_temperature_c!==null&&<p>Nhiệt độ hỗ trợ: {v.min_temperature_c}–{v.max_temperature_c}°C</p>}<p>Chờ báo giá · Lịch xe cần nhà xe xác nhận</p>
          <button className="button primary" disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);setError('');setSuccess('');try{await createTransport(search,v.id);await refresh();setSuccess('Đã gửi yêu cầu cho nhà xe.');setSearch(null);}catch(e){setError(explainError(e));}finally{setBusy(false);}}}>Gửi yêu cầu cho nhà xe</button></article>)}</div>
        <div className="row"><button disabled={vehiclePage===1} onClick={()=>setVehiclePage(p=>p-1)}>Trang trước</button><span>Trang {vehiclePage}</span><button disabled={vehiclePage*20>=matches.data.count} onClick={()=>setVehiclePage(p=>p+1)}>Trang sau</button></div>
      </>}</section>}
    <section className="stack"><h2>{carrier?'Yêu cầu gửi đến nhà xe':'Yêu cầu của bạn'}</h2><button className="button outline" onClick={()=>void refresh()}>Tải lại yêu cầu</button>
      {targetId&&(target.isError||(!target.isPending&&!target.data))&&<p role="alert">Không tìm thấy yêu cầu hoặc bạn không có quyền xem.</p>}
      {target.data&&<div className="transport-highlight"><p>Yêu cầu từ thông báo</p><RequestCard row={target.data} carrier={carrier} busy={busy} onAct={(...args)=>void act(...args)}/></div>}
      {requests.isPending?<p>Đang tải yêu cầu…</p>:requests.isError?<p role="alert">Không tải được yêu cầu. <button onClick={()=>void requests.refetch()}>Thử lại</button></p>:<>
        <p>{requests.data.count} yêu cầu</p>{requests.data.items.filter(r=>r.id!==target.data?.id).map(row=><RequestCard key={row.id} row={row} carrier={carrier} busy={busy} onAct={(...args)=>void act(...args)}/>)}
        {!requests.data.count&&<p>Chưa có yêu cầu vận chuyển.</p>}<div className="row"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Trang trước</button><span>Trang {page}</span><button disabled={page*20>=requests.data.count} onClick={()=>setPage(p=>p+1)}>Trang sau</button></div>
      </>}
    </section>
  </div>;
}
