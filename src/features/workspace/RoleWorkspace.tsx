import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import type { BuyRequest, FruitType, FruitVariety, Lot } from '../../lib/domain';
import { loadCatalog } from '../catalog/api';
import { explainError, formatDate, formatMoney, formatTonnes } from '../../lib/format';
import { rankRequestMatches } from '../matching/core';
import { searchFarmerMatches, type FarmerMatchResponse } from '../matching/api';
import { openConnection } from '../trading/api';
import { AppShell } from '../../layouts/app-shell';

const hybridEnabled = import.meta.env.VITE_MATCHING_MODE === 'hybrid';

export function RoleShell() {
  const { profile }=useAuth();
  return <AppShell role={profile?.role==='FARMER'?'FARMER':'CARRIER'} />;
}
interface Vehicle { id:string;license_plate:string;vehicle_type:string;capacity_kg:number;provinces:string[];active:boolean }
export function RoleWorkspace({view='dashboard'}:{view?:'dashboard'|'lots'|'matches'|'vehicles'}) {
  const { session,profile }=useAuth(); const navigate=useNavigate(); const farmer=profile?.role==='FARMER';
  const [lots,setLots]=useState<Lot[]>([]); const [requests,setRequests]=useState<BuyRequest[]>([]); const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [catalog,setCatalog]=useState<{types:FruitType[];varieties:FruitVariety[]}>({types:[],varieties:[]});
  const [remoteMatches,setRemoteMatches]=useState<{sourceId:string;response:FarmerMatchResponse}|null>(null);
  const [matchLoading,setMatchLoading]=useState(false);const [matchError,setMatchError]=useState('');
  const [selected,setSelected]=useState(''); const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;if(!session)return;
    async function load(){try{if(farmer){const [l,r,c]=await Promise.all([
      supabase.from('lots').select('id,farmer_id,fruit_type_id,variety_id,title,grade,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,district,certifications,packaging_options,selling_method,description,status,created_at').eq('farmer_id',session!.user.id).order('created_at',{ascending:false}),
      hybridEnabled?Promise.resolve({data:[],error:null}):supabase.from('buy_requests').select('*').eq('status','OPEN'),loadCatalog()]);if(l.error)throw l.error;if(r.error)throw r.error;if(active){setCatalog(c);setLots(l.data as Lot[]);setRequests(r.data as BuyRequest[]);setSelected(l.data.find(row=>row.status==='PUBLISHED')?.id||'');}}
      else{const result=await supabase.from('vehicles').select('id,license_plate,vehicle_type,capacity_kg,provinces,active').eq('carrier_id',session!.user.id);if(result.error)throw result.error;if(active)setVehicles(result.data as Vehicle[]);}}
      catch(cause){if(active)setError(explainError(cause));}finally{if(active)setLoading(false);}}
    void load();return()=>{active=false;};},[session?.user.id,farmer]);
  useEffect(()=>{
    let active=true;
    setRemoteMatches(null);setMatchError('');
    if(!hybridEnabled||!farmer||!selected||!session){setMatchLoading(false);return;}
    setMatchLoading(true);
    async function search(){
      try{const response=await searchFarmerMatches(selected);if(active)setRemoteMatches({sourceId:selected,response});}
      catch(cause){
        if(!active)return;
        setMatchError(`Tìm kiếm E5 chưa khả dụng; đang dùng so tên và quy tắc. ${explainError(cause)}`);
        try{const fallback=await supabase.from('buy_requests').select('*').eq('status','OPEN');
          if(fallback.error)throw fallback.error;if(active)setRequests(fallback.data as BuyRequest[]);
        }catch(fallbackError){if(active){setRequests([]);setMatchError(explainError(fallbackError));}}
      }finally{if(active)setMatchLoading(false);}
    }
    void search();return()=>{active=false;};
  },[selected,farmer,session?.user.id]);
  const lot=lots.find(row=>row.id===selected);
  const response=remoteMatches?.sourceId===selected?remoteMatches.response:null;
  const matches=matchLoading?[]:response?.items??(lot?rankRequestMatches(requests.map(request=>({request})),lot,'rule-only',{catalog}):[]);
  return <><div className="page-heading"><div><span className="eyebrow">{farmer?'Nhà vườn':'Đơn vị vận tải'}</span><h1>{view==='lots'?'Danh sách lô hàng':view==='matches'?'Người mua phù hợp':farmer?'Lô hàng & nhu cầu phù hợp':'Phương tiện của bạn'}</h1><p>Dữ liệu tài khoản của bạn trên hệ thống.</p></div><Link className="button outline" to={farmer?'/farmer/profile':'/carrier/profile'}>Hồ sơ</Link></div>
    {error&&<p className="notice error" role="alert">{error}</p>}{loading?<div className="panel empty-state">Đang tải…</div>:farmer?<>{view!=='matches'&&<section className="panel"><h2>Lô hàng của bạn</h2><div className="admin-cards">{lots.map(row=><article className="admin-card" key={row.id}><div><h3>{row.title}</h3><p>{formatTonnes(row.quantity_kg)} · {formatMoney(row.price_vnd_per_kg)} · {formatDate(row.harvest_start)} – {formatDate(row.harvest_end)}</p></div><span className="status-pill">{row.status}</span></article>)}</div>{!lots.length&&<p>Chưa có lô hàng.</p>}<p className="muted small-text">Đăng/sửa lô và upload ảnh nâng cao đang chờ Dev A hoàn thiện.</p></section>}
      {view!=='lots'&&<section className="panel"><h2>Nhu cầu phù hợp</h2><label>Chọn lô đang công bố<select value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Chọn lô</option>{lots.filter(row=>row.status==='PUBLISHED').map(row=><option value={row.id} key={row.id}>{row.title}</option>)}</select></label>
        <p className="muted">Ưu tiên tên/giống khớp trước, rồi xét giá và khối lượng.</p>
        <p className="muted">{response?.meta.mode==='hybrid'?'Đã lấy tối đa 20 nhu cầu bằng cosine E5 rồi xếp lại theo độ khớp tên.':'Đang dùng so tên và quy tắc giá/lượng; E5 chưa hoạt động trong chế độ này.'}</p>
        {matchError&&<p className="notice error" role="alert">{matchError}</p>}{matchLoading&&<p>Đang tìm nhu cầu phù hợp…</p>}
        <div className="admin-cards">{matches.map(row=><article className="admin-card" key={row.request.id}><div><h3>{row.request.title}</h3><p>{row.nameMatch.reason}</p>{row.cosineSimilarity!=null&&<p>Cosine E5: {row.cosineSimilarity.toFixed(4)}</p>}<p>{formatTonnes(row.request.target_quantity_kg)} · {row.score.toFixed(1)} điểm {response?.meta.mode==='hybrid'?'E5/giá/lượng':'giá/lượng'}</p></div>
          <button className="button primary" disabled={busy} onClick={async()=>{if(!lot)return;setBusy(true);setError('');try{const id=await openConnection(lot.id,row.request.id);navigate(`/farmer/invitations?connectionId=${id}`);}catch(cause){setError(explainError(cause));}finally{setBusy(false);}}}>Gửi lời mời</button></article>)}</div>{lot&&!matchLoading&&!matches.length&&<p>Chưa có nhu cầu phù hợp.</p>}</section>}</>:
      <><section className="panel"><h2>Danh sách phương tiện</h2><div className="admin-cards">{vehicles.map(row=><article className="admin-card" key={row.id}><div><h3>{row.license_plate}</h3><p>{row.vehicle_type} · {formatTonnes(row.capacity_kg)} · {row.provinces.join(', ')||'Chưa khai báo tuyến'}</p></div><span className="status-pill">{row.active?'Hoạt động':'Tạm ngưng'}</span></article>)}</div>{!vehicles.length&&<p>Chưa có phương tiện được khai báo.</p>}</section>
        {view!=='vehicles'&&<section className="panel"><h2>Điều phối vận chuyển</h2><p>Đặt xe, báo giá và tracking chờ tích hợp API nhà cung cấp.</p><Link className="text-link" to="/carrier/transport">Xem trạng thái tính năng →</Link></section>}</>}
  </>;
}

export function RoleProfilePage(){
  const {session,profile,retry}=useAuth();const farmer=profile?.role==='FARMER'; const table=farmer?'farmer_profiles':'carrier_profiles';const nameField=farmer?'farm_name':'company_name';
  const [name,setName]=useState('');const [province,setProvince]=useState('');const [address,setAddress]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
  useEffect(()=>{let active=true;if(!session)return;supabase.from(table).select(`${nameField},province,address`).eq('user_id',session.user.id).maybeSingle().then(({data,error:loadError})=>{if(!active)return;if(loadError)setError(explainError(loadError));else if(data){const row=data as unknown as Record<string,string>;setName(row[nameField]||'');setProvince(row.province||'');setAddress(row.address||'');}setLoading(false);});return()=>{active=false;};},[session?.user.id,table,nameField]);
  return <><div className="page-heading"><h1>Hồ sơ {farmer?'nhà vườn':'đơn vị vận tải'}</h1></div><section className="panel narrow">{loading?<p>Đang tải…</p>:<form className="profile-form" onSubmit={async event=>{event.preventDefault();if(!session)return;setBusy(true);setError('');setSuccess('');try{const result=await supabase.from(table).upsert({user_id:session.user.id,[nameField]:name.trim(),province:province.trim(),address:address.trim()||null},{onConflict:'user_id'}).select('user_id').single();if(result.error)throw result.error;setSuccess('Đã lưu hồ sơ.');retry();}catch(cause){setError(explainError(cause));}finally{setBusy(false);}}}>
    <label>{farmer?'Tên nhà vườn':'Tên công ty'}<input maxLength={160} value={name} onChange={event=>setName(event.target.value)} required/></label><label>Tỉnh<input maxLength={120} value={province} onChange={event=>setProvince(event.target.value)} required/></label><label>Địa chỉ riêng<textarea maxLength={500} value={address} onChange={event=>setAddress(event.target.value)}/></label><button className="button primary" disabled={busy}>Lưu hồ sơ</button></form>}{error&&<p className="form-error" role="alert">{error}</p>}{success&&<p className="form-success">{success}</p>}</section></>;
}
