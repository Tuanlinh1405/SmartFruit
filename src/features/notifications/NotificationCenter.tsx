import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import '../transport/transport.css';

export interface Notice {id:string;kind:string;title:string;path:string;created_at:string;read_at:string|null}
export function useNotifications(page=1){
  const{session}=useAuth();const userId=session?.user.id??'';const[visible,setVisible]=useState(()=>typeof document==='undefined'||document.visibilityState!=='hidden');
  useEffect(()=>{const update=()=>setVisible(document.visibilityState!=='hidden');document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  return useQuery({queryKey:['notifications',userId,page],enabled:!!userId&&visible,retry:false,refetchInterval:visible?30_000:false,refetchOnWindowFocus:true,queryFn:async()=>{
    const [list,unread]=await Promise.all([supabase.from('notifications').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range((page-1)*20,page*20-1),supabase.from('notifications').select('id',{count:'exact',head:true}).is('read_at',null)]);
    if(list.error)throw list.error;if(unread.error)throw unread.error;return{items:list.data as Notice[],count:list.count??0,unread:unread.count??0};
  }});
}
export async function markRead(id:string|null,throughTime?:string){const r=await supabase.rpc('mark_notifications_read',{target_id:id,...(throughTime?{through_time:throughTime}:{})});if(r.error)throw r.error;}

export function NotificationCenter({onNavigate}:{onNavigate?:()=>void}){
  const[page,setPage]=useState(1),[error,setError]=useState(''),[busy,setBusy]=useState(false);const q=useNotifications(page);const client=useQueryClient();const{session}=useAuth();
  async function read(id:string|null,time?:string){setBusy(true);setError('');try{await markRead(id,time);await client.invalidateQueries({queryKey:['notifications',session?.user.id]});}catch{setError('Chưa đánh dấu được thông báo. Vui lòng thử lại.');}finally{setBusy(false);}}
  return <div className="notification-list">{error&&<p role="alert">{error}</p>}
    {q.isPending?<p>Đang tải thông báo…</p>:q.isError?<p role="alert">Không tải được thông báo. <button onClick={()=>void q.refetch()}>Thử lại</button></p>:<>
      <p>{q.data.unread} chưa đọc · {q.data.count} thông báo</p><div className="row"><button className="button outline" disabled={busy||!q.data.unread} onClick={()=>void read(null,new Date(q.dataUpdatedAt).toISOString())}>Đánh dấu tất cả đã đọc</button><button className="button outline" onClick={()=>void q.refetch()}>Tải lại</button></div>
      {!q.data.items.length&&<p>Chưa có thông báo. Hoạt động mới liên quan đến bạn sẽ xuất hiện tại đây.</p>}
      {q.data.items.map(n=><article key={n.id} data-unread={!n.read_at}><Link to={n.path} onClick={()=>{if(!n.read_at)void read(n.id,n.created_at);onNavigate?.();}}>{n.title}</Link><small>{new Date(n.created_at).toLocaleString('vi-VN')} · {n.read_at?'Đã đọc':'Chưa đọc'}</small>{!n.read_at&&<button className="text-link" disabled={busy} onClick={()=>void read(n.id,n.created_at)}>Đánh dấu đã đọc</button>}</article>)}
      <div className="row"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Trang trước</button><span>Trang {page}</span><button disabled={page*20>=q.data.count} onClick={()=>setPage(p=>p+1)}>Trang sau</button></div>
    </>}
  </div>;
}

// The bell keeps the current conversation's grouped message notice read while visible.
export function ActiveConversationRead(){
  const q=useNotifications();const location=useLocation();const client=useQueryClient();const{session}=useAuth();
  useEffect(()=>{
    if(document.visibilityState==='hidden'||!location.pathname.endsWith('/negotiations'))return;
    const current=new URLSearchParams(location.search).get('connectionId');if(!current)return;
    const notices=q.data?.items.filter(n=>!n.read_at&&n.kind==='trade_messages'&&new URLSearchParams(n.path.split('?')[1]).get('connectionId')===current)??[];
    if(notices.length)void Promise.all(notices.map(n=>markRead(n.id,n.created_at))).then(()=>client.invalidateQueries({queryKey:['notifications',session?.user.id]})).catch(()=>{});
  },[q.data,location.pathname,location.search,client,session?.user.id]);return null;
}

export function NotificationsPage(){return <section className="panel"><h1>Thông báo</h1><NotificationCenter/></section>;}
