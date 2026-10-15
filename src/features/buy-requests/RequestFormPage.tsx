import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { BuyRequest, FruitType, FruitVariety, RequestInput, RequestStatus, TradeMethod, TransportBy } from '../../lib/domain';
import { tradeLabels, transportLabels } from '../../lib/domain';
import { formatMoney, formatTonnes, explainError } from '../../lib/format';
import { loadCatalog } from '../catalog/api';
import { createRequest, getMyRequest, updateRequest } from './api';

type Draft = {
  fruit_type_id: string; variety_id: string; title: string; grade: string;
  tonnes: string; minLotTonnes: string; allow_partial: boolean;
  minPrice: string; maxPrice: string; start: string; end: string;
  provinces: string; districts: string; quality: string; packaging: string;
  buying_method: TradeMethod; transport_by: TransportBy; notes: string;
};

const empty: Draft = { fruit_type_id: '', variety_id: '', title: '', grade: '', tonnes: '',
  minLotTonnes: '', allow_partial: true, minPrice: '', maxPrice: '', start: '', end: '',
  provinces: '', districts: '', quality: '', packaging: '', buying_method: 'PARTIAL',
  transport_by: 'UNDECIDED', notes: '' };
const labels = (value: string) => [...new Set(value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean))];
const price = (value: string) => Number(value.trim().replace(/[.\s]/g, ''));

function fromRequest(row: BuyRequest): Draft {
  return { fruit_type_id: row.fruit_type_id, variety_id: row.variety_id ?? '', title: row.title,
    grade: row.grade ?? '', tonnes: String(row.target_quantity_kg / 1000),
    minLotTonnes: row.min_lot_quantity_kg ? String(row.min_lot_quantity_kg / 1000) : '',
    allow_partial: row.allow_partial, minPrice: String(row.min_price_vnd_per_kg),
    maxPrice: String(row.max_price_vnd_per_kg), start: row.required_start, end: row.required_end,
    provinces: row.preferred_provinces.join(', '), districts: row.preferred_districts.join(', '),
    quality: row.quality_requirements.join(', '), packaging: row.packaging_options.join(', '),
    buying_method: row.buying_method, transport_by: row.transport_by, notes: row.notes };
}

export function validateDraft(draft: Draft, status: RequestStatus): RequestInput {
  const tonnesToKg = (value: string) => Number(value.replace(',', '.')) * 1000;
  const validKg = (value: number) => Number.isSafeInteger(Math.round(value)) && value > 0 &&
    Math.abs(value - Math.round(value)) < 0.000001;
  const targetRaw = tonnesToKg(draft.tonnes);
  const minLotRaw = draft.minLotTonnes ? tonnesToKg(draft.minLotTonnes) : null;
  const target = Math.round(targetRaw);
  const minLot = minLotRaw === null ? null : Math.round(minLotRaw);
  const minPrice = price(draft.minPrice);
  const maxPrice = price(draft.maxPrice);
  if (!draft.fruit_type_id || !draft.title.trim()) throw new Error('Chọn loại quả và nhập tên nhu cầu.');
  if (!validKg(targetRaw)) throw new Error('Khối lượng phải lớn hơn 0 và chính xác đến 1 kg.');
  if (minLotRaw !== null && (!validKg(minLotRaw) || minLot! > target)) throw new Error('Lượng tối thiểu mỗi lô phải lớn hơn 0 và không vượt tổng nhu cầu.');
  if (![minPrice, maxPrice].every(value => Number.isSafeInteger(value) && value > 0) || minPrice > maxPrice) throw new Error('Khoảng giá VND/kg không hợp lệ.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.start) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.end) || draft.start > draft.end) throw new Error('Khoảng ngày thu mua không hợp lệ.');
  return { fruit_type_id: draft.fruit_type_id, variety_id: draft.variety_id || null,
    title: draft.title.trim(), grade: draft.grade.trim() || null,
    target_quantity_kg: target, min_lot_quantity_kg: minLot, allow_partial: draft.allow_partial,
    min_price_vnd_per_kg: minPrice, max_price_vnd_per_kg: maxPrice,
    required_start: draft.start, required_end: draft.end,
    preferred_provinces: labels(draft.provinces), preferred_districts: labels(draft.districts),
    quality_requirements: labels(draft.quality), packaging_options: labels(draft.packaging),
    buying_method: draft.buying_method, transport_by: draft.transport_by,
    notes: draft.notes.trim(), status };
}

export function RequestFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [draft, setDraft] = useState<Draft>(empty);
  const [status, setStatus] = useState<RequestStatus>('DRAFT');
  const [types, setTypes] = useState<FruitType[]>([]);
  const [varieties, setVarieties] = useState<FruitVariety[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const createId = useRef(crypto.randomUUID());

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const catalog = await loadCatalog();
        if (!active) return;
        setTypes(catalog.types); setVarieties(catalog.varieties);
        if (id && session) {
          const row = await getMyRequest(id, session.user.id);
          if (!active) return;
          if (!row) throw new Error('Không tìm thấy nhu cầu thuộc tài khoản của bạn.');
          setDraft(fromRequest(row)); setStatus(row.status);
        }
      } catch (cause) { if (active) setError(explainError(cause)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id, session?.user.id]);

  const options = useMemo(() => varieties.filter(item => item.fruit_type_id === draft.fruit_type_id), [varieties, draft.fruit_type_id]);
  const isFinal = status === 'CLOSED' || status === 'CANCELLED';
  async function save(nextStatus: RequestStatus) {
    if (!session || busy || isFinal) return;
    try {
      const input = validateDraft(draft, nextStatus);
      setBusy(true); setError('');
      if (id) await updateRequest(id, session.user.id, input);
      else await createRequest(createId.current, session.user.id, input);
      navigate('/buyer/requests', { replace: true });
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void save('OPEN'); }
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(previous => ({ ...previous, [key]: value }));

  return <><div className="page-heading"><div><span className="eyebrow">Nhu cầu thu mua</span><h1>{id ? 'Chi tiết yêu cầu' : 'Tạo yêu cầu thu mua'}</h1><p>Nhập thông tin để tìm nguồn hàng đúng thời điểm và ngân sách.</p></div><Link className="button outline" to="/buyer/requests">← Danh sách</Link></div>
    {loading ? <div className="panel empty-state">Đang tải dữ liệu…</div> : <div className="form-layout">
      <form className="panel form-panel" onSubmit={submit}>
        <fieldset disabled={busy || isFinal}><legend>1. Thông tin nông sản</legend>
          <div className="form-grid"><label>Loại nông sản *<select value={draft.fruit_type_id} onChange={e => setDraft({ ...draft, fruit_type_id: e.target.value, variety_id: '' })} required>
            <option value="">Chọn loại</option>{types.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label>Giống<select value={draft.variety_id} onChange={e => set('variety_id', e.target.value)}><option value="">Mọi giống</option>{options.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label className="wide">Tên nhu cầu *<input value={draft.title} maxLength={200} onChange={e => set('title', e.target.value)} placeholder="Ví dụ: Thu mua sầu riêng Ri6 loại A" required /></label>
            <label>Phân loại<input value={draft.grade} maxLength={80} onChange={e => set('grade', e.target.value)} placeholder="Loại A" /></label>
            <label>Khối lượng tổng (tấn) *<input type="number" min="0.001" step="0.001" value={draft.tonnes} onChange={e => set('tonnes', e.target.value)} required /></label>
            <label>Lượng tối thiểu mỗi lô (tấn)<input type="number" min="0.001" step="0.001" value={draft.minLotTonnes} onChange={e => set('minLotTonnes', e.target.value)} /></label>
            <label className="checkbox-field"><input type="checkbox" checked={draft.allow_partial} onChange={e => set('allow_partial', e.target.checked)} /> Chấp nhận lô đáp ứng một phần</label></div></fieldset>
        <fieldset disabled={busy || isFinal}><legend>2. Thời gian lấy hàng và giá</legend><div className="form-grid">
          <label>Từ ngày *<input type="date" value={draft.start} onChange={e => set('start', e.target.value)} required /></label>
          <label>Đến ngày *<input type="date" value={draft.end} onChange={e => set('end', e.target.value)} required /></label>
          <label>Giá tối thiểu (VND/kg) *<input type="number" min="1" step="1" value={draft.minPrice} onChange={e => set('minPrice', e.target.value)} required /></label>
          <label>Giá tối đa (VND/kg) *<input type="number" min="1" step="1" value={draft.maxPrice} onChange={e => set('maxPrice', e.target.value)} required /></label></div></fieldset>
        <fieldset disabled={busy || isFinal}><legend>3. Điều kiện thu mua</legend><div className="form-grid">
          <label>Tỉnh ưu tiên (ngăn cách bằng dấu phẩy)<input value={draft.provinces} onChange={e => set('provinces', e.target.value)} placeholder="Đồng Nai, Lâm Đồng" /></label>
          <label>Huyện ưu tiên<input value={draft.districts} onChange={e => set('districts', e.target.value)} /></label>
          <label>Chất lượng / chứng nhận tự khai<input value={draft.quality} onChange={e => set('quality', e.target.value)} placeholder="VietGAP, GlobalGAP" /></label>
          <label>Đóng gói (mã CARTON, BULK...)<input value={draft.packaging} onChange={e => set('packaging', e.target.value)} placeholder="CARTON, PLASTIC_CRATE" /></label>
          <label>Hình thức mua<select value={draft.buying_method} onChange={e => set('buying_method', e.target.value as TradeMethod)}>{Object.entries(tradeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Vận chuyển<select value={draft.transport_by} onChange={e => set('transport_by', e.target.value as TransportBy)}>{Object.entries(transportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="wide">Ghi chú công khai<textarea value={draft.notes} maxLength={5000} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Yêu cầu thu mua sẽ được nhà vườn thấy…" /></label>
        </div></fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!isFinal && <div className="form-actions"><button className="button outline" type="button" disabled={busy} onClick={() => void save('DRAFT')}>Lưu nháp</button><button className="button accent" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Đăng yêu cầu →'}</button></div>}
        {isFinal && <p className="notice">Yêu cầu đã kết thúc nên chỉ có thể xem.</p>}
      </form>
      <aside className="panel preview-panel"><span className="eyebrow">Xem trước yêu cầu</span><h2>{draft.title || 'Nhu cầu nông sản'}</h2>
        <div className="preview-cover">✳ <span>{types.find(item => item.id === draft.fruit_type_id)?.name || 'Chọn nông sản'}</span></div>
        <dl><div><dt>Khối lượng</dt><dd>{Number(draft.tonnes) > 0 ? formatTonnes(Number(draft.tonnes) * 1000) : '—'}</dd></div>
          <div><dt>Giá mong muốn</dt><dd>{price(draft.minPrice) > 0 && price(draft.maxPrice) > 0 ? `${formatMoney(price(draft.minPrice))} – ${formatMoney(price(draft.maxPrice))}` : '—'}</dd></div>
          <div><dt>Khu vực</dt><dd>{draft.provinces || 'Không giới hạn'}</dd></div>
          <div><dt>Đóng gói</dt><dd>{draft.packaging || 'Chưa chọn'}</dd></div></dl>
        <p className="muted">Dữ liệu sẽ hiển thị cho nhà vườn khi trạng thái là Đang mở.</p></aside>
    </div>}</>;
}
