import { useState } from 'react';
import { MapPin, MessageCircle, Send, Eye } from 'lucide-react';
import { Modal } from '../../../components/ui/dialog';
import { formatDate, formatMoney, formatTonnes } from '../../../lib/format';
import type { BuyCandidate, MatchResult } from './farmer-matching';
import './buyer-match-card.css';

export type MatchAction = 'message' | 'offer';
interface Partner { display_name:string;province:string|null }
const packaging:Record<string,string>={CARTON:'Thùng carton',PLASTIC_CRATE:'Sọt nhựa',CRATE:'Sọt',BULK:'Hàng xá',FOAM_BOX:'Thùng xốp'};
export function BuyerMatchCard({request,partner,productName,match,busy,error,onAction}:{request:BuyCandidate;partner?:Partner;productName:string;match:MatchResult;busy:boolean;error?:string;onAction:(action:MatchAction)=>void}){
  const [details,setDetails]=useState(false);
  const name=partner?.display_name||'Đối tác thu mua';
  const initials=name.trim().split(/\s+/).filter(Boolean).map(word=>word[0]).slice(0,2).join('').toLocaleUpperCase('vi-VN');
  const quality=request.quality_requirements??[],packages=request.packaging_options??[];
  const facts=<><div><dt>Sản lượng nhập</dt><dd>{formatTonnes(request.target_quantity_kg)}</dd></div><div><dt>Giá nhập</dt><dd>{formatMoney(request.min_price_vnd_per_kg)} – {formatMoney(request.max_price_vnd_per_kg)}</dd></div><div><dt>Thời gian nhập</dt><dd>{formatDate(request.required_start)} – {formatDate(request.required_end)}</dd></div></>;
  return <>
    <article className="panel buyer-match-card" aria-label={`Người mua ${name}`}>
      <div className="buyer-match-identity"><span className="buyer-match-avatar" aria-hidden="true">{initials}</span><div><h2>{name}</h2><p className="buyer-match-location"><MapPin size={13} aria-hidden="true"/>{partner?.province||'Chưa khai báo khu vực'}</p><p className="buyer-match-product">{productName} · {request.title}</p></div></div>
      <dl className="buyer-match-facts">{facts}</dl>
      <span className="match-pill buyer-match-score">{match.score.toFixed(1)}% phù hợp</span>
      <div className="buyer-match-tags">{quality.map((label,i)=><span className="buyer-match-tag quality" key={`q-${i}`} title="Yêu cầu của người mua, không phải chứng nhận đã xác minh">{label}</span>)}{packages.map((label,i)=><span className="buyer-match-tag" key={`p-${i}`}>{packaging[label]??label}</span>)}{!quality.length&&!packages.length&&<span className="buyer-match-note">{request.allow_partial?'Chấp nhận cung ứng một phần':'Cần đáp ứng đủ sản lượng'}</span>}</div>
      <div className="buyer-match-actions"><button className="button button-primary" onClick={()=>setDetails(true)}><Eye size={15} aria-hidden="true"/>Xem chi tiết</button><button className="button button-secondary" disabled={busy} title="Trao đổi sau khi hai bên đồng ý kết nối" onClick={()=>onAction('message')}><MessageCircle size={15} aria-hidden="true"/>Nhắn tin</button><button className="button buyer-match-offer" disabled={busy} onClick={()=>onAction('offer')}><Send size={15} aria-hidden="true"/>{busy?'Đang mở…':'Gửi đề nghị'}</button></div>
    </article>
    <Modal open={details} onOpenChange={setDetails} title={`Nhu cầu thu mua · ${name}`} description={`${productName} · ${request.title}`} className="buyer-match-dialog">
      <p className="buyer-match-location"><MapPin size={14} aria-hidden="true"/>{partner?.province||'Chưa khai báo khu vực'}</p>
      <dl className="buyer-match-detail-facts">{facts}<div><dt>Khu vực nhận hàng</dt><dd>{request.preferred_provinces.length?request.preferred_provinces.join(', '):'Không giới hạn khu vực'}</dd></div><div><dt>Khối lượng tối thiểu mỗi lô</dt><dd>{request.min_lot_quantity_kg?formatTonnes(request.min_lot_quantity_kg):'Chưa yêu cầu'}</dd></div><div><dt>Hình thức đáp ứng</dt><dd>{request.allow_partial?'Chấp nhận một phần':'Đủ sản lượng'}</dd></div></dl>
      {!!quality.length&&<p><strong>Yêu cầu chất lượng: </strong>{quality.join(', ')}</p>}{!!packages.length&&<p><strong>Đóng gói: </strong>{packages.map(p=>packaging[p]??p).join(', ')}</p>}{request.notes&&<p><strong>Ghi chú: </strong>{request.notes}</p>}
      <p className="buyer-match-note">Hai bên cần đồng ý kết nối trước khi nhắn tin hoặc trao đổi đề nghị. Chỉ hiển thị khu vực công khai, chưa tính khoảng cách.</p>
      {error&&<p role="alert">{error}</p>}
      <div className="buyer-match-actions"><button className="button button-secondary" onClick={()=>setDetails(false)}>Đóng chi tiết</button><button className="button buyer-match-offer" disabled={busy} onClick={()=>onAction('offer')}>Gửi đề nghị</button></div>
    </Modal>
  </>;
}
