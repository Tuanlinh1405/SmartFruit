import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatTransportFare } from '../../lib/format';
import { transportLabels, type TransportRequest } from './api';
import './transport.css';
export function TransportSummary({userId,role}:{userId:string;role:'farmer'|'buyer'|'carrier'}){
  const q=useQuery({queryKey:['transport-summary',userId],enabled:!!userId,retry:false,queryFn:async()=>{
    const [latest,total]=await Promise.all([supabase.from('transport_requests').select('*').order('created_at',{ascending:false}).order('id').limit(1),supabase.from('transport_requests').select('id',{count:'exact',head:true}).eq('status','QUOTED')]);
    if(latest.error)throw latest.error;if(total.error)throw total.error;return{latest:latest.data[0] as TransportRequest|undefined,quotes:total.count??0};
  }});
  return <section className="panel" aria-label="Vận chuyển"><h2>Vận chuyển</h2>{q.isPending?<p>Đang tải vận chuyển…</p>:q.isError?<p role="alert">Không tải được vận chuyển. <button className="text-link" onClick={()=>void q.refetch()}>Thử lại</button></p>:<><p>{q.data.quotes} yêu cầu đã có báo giá</p>{q.data.latest?<><strong>{q.data.latest.source_title}</strong><p>{transportLabels[q.data.latest.status]}</p><p>{q.data.latest.quote_vnd?formatTransportFare(q.data.latest.quote_vnd):'Chờ báo giá'}</p></>:<p>Chưa có yêu cầu vận chuyển.</p>}</>}<Link to={role==='carrier'?'/carrier/requests':`/${role}/transport`}>{role==='carrier'?'Xem yêu cầu':'Tìm xe và xem báo giá'} →</Link></section>;
}

