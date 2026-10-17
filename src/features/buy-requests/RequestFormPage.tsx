import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { BuyRequest, RequestInput, RequestStatus, TradeMethod, TransportBy } from '../../lib/domain';
import { tradeLabels, transportLabels } from '../../lib/domain';
import { formatMoney, formatTonnes, explainError } from '../../lib/format';
import { loadCatalog } from '../catalog/api';
import { createRequest, getMyRequest, updateRequest } from './api';
import { Button } from '../../components/ui/button';
import { DateInput, NumberWithUnit, Select, TextArea, TextField } from '../../components/ui/fields';
import { PageHeader } from '../../components/shared/content';
import { resolveRequestProductName, type RequestCatalog } from './product-name';

type Draft = {
  title: string; grade: string;
  tonnes: string; minLotTonnes: string; allow_partial: boolean;
  minPrice: string; maxPrice: string; start: string; end: string;
  provinces: string; districts: string; quality: string; packaging: string;
  buying_method: TradeMethod; transport_by: TransportBy; notes: string;
};

const empty: Draft = { title: '', grade: '', tonnes: '',
  minLotTonnes: '', allow_partial: true, minPrice: '', maxPrice: '', start: '', end: '',
  provinces: '', districts: '', quality: '', packaging: '', buying_method: 'PARTIAL',
  transport_by: 'UNDECIDED', notes: '' };
const labels = (value: string) => [...new Set(value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean))];
const price = (value: string) => Number(value.trim().replace(/[.\s]/g, ''));

function fromRequest(row: BuyRequest): Draft {
  return { title: row.title,
    grade: row.grade ?? '', tonnes: String(row.target_quantity_kg / 1000),
    minLotTonnes: row.min_lot_quantity_kg ? String(row.min_lot_quantity_kg / 1000) : '',
    allow_partial: row.allow_partial, minPrice: String(row.min_price_vnd_per_kg),
    maxPrice: String(row.max_price_vnd_per_kg), start: row.required_start, end: row.required_end,
    provinces: row.preferred_provinces.join(', '), districts: row.preferred_districts.join(', '),
    quality: row.quality_requirements.join(', '), packaging: row.packaging_options.join(', '),
    buying_method: row.buying_method, transport_by: row.transport_by, notes: row.notes };
}

export function validateDraft(draft: Draft, status: RequestStatus, catalog: RequestCatalog, original?: BuyRequest): RequestInput {
  const tonnesToKg = (value: string) => Number(value.replace(',', '.')) * 1000;
  const validKg = (value: number) => Number.isSafeInteger(Math.round(value)) && value > 0 &&
    Math.abs(value - Math.round(value)) < 0.000001;
  const targetRaw = tonnesToKg(draft.tonnes);
  const minLotRaw = draft.minLotTonnes ? tonnesToKg(draft.minLotTonnes) : null;
  const target = Math.round(targetRaw);
  const minLot = minLotRaw === null ? null : Math.round(minLotRaw);
  const minPrice = price(draft.minPrice);
  const maxPrice = price(draft.maxPrice);
  if (!draft.title.trim()) throw new Error('Nhập tên nông sản.');
  const unchangedName = original && draft.title.trim() === original.title.trim();
  const product = unchangedName
    ? { fruit_type_id: original.fruit_type_id, variety_id: original.variety_id }
    : resolveRequestProductName(draft.title, catalog);
  if (!validKg(targetRaw)) throw new Error('Khối lượng phải lớn hơn 0 và chính xác đến 1 kg.');
  if (minLotRaw !== null && (!validKg(minLotRaw) || minLot! > target)) throw new Error('Lượng tối thiểu mỗi lô phải lớn hơn 0 và không vượt tổng nhu cầu.');
  if (![minPrice, maxPrice].every(value => Number.isSafeInteger(value) && value > 0) || minPrice > maxPrice) throw new Error('Khoảng giá VND/kg không hợp lệ.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.start) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.end) || draft.start > draft.end) throw new Error('Khoảng ngày thu mua không hợp lệ.');
  return { ...product,
    title: draft.title.trim(), grade: unchangedName ? draft.grade.trim() || null : null,
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
  const [catalog, setCatalog] = useState<RequestCatalog>({ types: [], varieties: [] });
  const original = useRef<BuyRequest | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const createId = useRef(crypto.randomUUID());

  useEffect(() => {
    let active = true;
    original.current = undefined;
    setDraft(empty); setStatus('DRAFT'); setLoading(true); setError('');
    async function load() {
      try {
        const catalog = await loadCatalog();
        if (!active) return;
        setCatalog(catalog);
        if (id && session) {
          const row = await getMyRequest(id, session.user.id);
          if (!active) return;
          if (!row) throw new Error('Không tìm thấy nhu cầu thuộc tài khoản của bạn.');
          original.current = row; setDraft(fromRequest(row)); setStatus(row.status);
        }
      } catch (cause) { if (active) setError(explainError(cause)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id, session?.user.id]);

  const isFinal = status === 'CLOSED' || status === 'CANCELLED';
  async function save(nextStatus: RequestStatus) {
    if (!session || busy || isFinal) return;
    try {
      const input = validateDraft(draft, nextStatus, catalog, original.current);
      setBusy(true); setError('');
      if (id) await updateRequest(id, session.user.id, input);
      else await createRequest(createId.current, session.user.id, input);
      navigate('/buyer/requests', { replace: true });
    } catch (cause) { setError(explainError(cause)); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void save('OPEN'); }
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(previous => ({ ...previous, [key]: value }));

  return <><PageHeader eyebrow="Nhu cầu thu mua" title={id ? 'Chi tiết yêu cầu' : 'Tạo yêu cầu thu mua'} description="Nhập thông tin để tìm nguồn hàng đúng thời điểm và ngân sách." action={<Link className="button button-secondary" to="/buyer/requests">← Danh sách</Link>} />
    {loading ? <div className="panel empty-state">Đang tải dữ liệu…</div> : <div className="form-layout">
      <form className="panel form-panel" onSubmit={submit}>
        <fieldset disabled={busy || isFinal}><legend>1. Thông tin nông sản</legend>
          <div className="form-grid">
            <div className="wide"><TextField label="Tên nông sản" value={draft.title} maxLength={200} onChange={e => set('title', e.target.value)} placeholder="Ví dụ: Sầu riêng Ri6" hint="Nhập tên và giống (nếu có) trong cùng một ô." required /></div>
            <NumberWithUnit label="Khối lượng tổng" unit="tấn" min="0.001" step="0.001" value={draft.tonnes} onChange={e => set('tonnes', e.target.value)} required />
            <NumberWithUnit label="Lượng tối thiểu mỗi lô" unit="tấn" min="0.001" step="0.001" value={draft.minLotTonnes} onChange={e => set('minLotTonnes', e.target.value)} />
            <label className="checkbox-field"><input type="checkbox" checked={draft.allow_partial} onChange={e => set('allow_partial', e.target.checked)} /> Chấp nhận lô đáp ứng một phần</label></div></fieldset>
        <fieldset disabled={busy || isFinal}><legend>2. Thời gian lấy hàng và giá</legend><div className="form-grid">
          <DateInput label="Từ ngày" value={draft.start} onChange={e => set('start', e.target.value)} required />
          <DateInput label="Đến ngày" value={draft.end} onChange={e => set('end', e.target.value)} required />
          <NumberWithUnit label="Giá tối thiểu" unit="VND/kg" min="1" step="1" value={draft.minPrice} onChange={e => set('minPrice', e.target.value)} required />
          <NumberWithUnit label="Giá tối đa" unit="VND/kg" min="1" step="1" value={draft.maxPrice} onChange={e => set('maxPrice', e.target.value)} required /></div></fieldset>
        <fieldset disabled={busy || isFinal}><legend>3. Điều kiện thu mua</legend><div className="form-grid">
          <TextField label="Tỉnh dự kiến (ngăn cách bằng dấu phẩy)" value={draft.provinces} onChange={e => set('provinces', e.target.value)} placeholder="Đồng Nai, Lâm Đồng" />
          <TextField label="Huyện dự kiến" value={draft.districts} onChange={e => set('districts', e.target.value)} />
          <p className="muted wide">Khu vực được lưu để tham khảo, chưa dùng để lọc hoặc xếp hạng kết quả phù hợp.</p>
          <TextField label="Chất lượng / chứng nhận tự khai" value={draft.quality} onChange={e => set('quality', e.target.value)} placeholder="VietGAP, GlobalGAP" />
          <TextField label="Đóng gói (mã CARTON, BULK...)" value={draft.packaging} onChange={e => set('packaging', e.target.value)} placeholder="CARTON, PLASTIC_CRATE" />
          <Select label="Hình thức mua" value={draft.buying_method} onChange={e => set('buying_method', e.target.value as TradeMethod)}>{Object.entries(tradeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <Select label="Vận chuyển" value={draft.transport_by} onChange={e => set('transport_by', e.target.value as TransportBy)}>{Object.entries(transportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <div className="wide"><TextArea label="Ghi chú công khai" value={draft.notes} maxLength={5000} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Yêu cầu thu mua sẽ được nhà vườn thấy…" /></div>
        </div></fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!isFinal && <div className="form-actions"><Button variant="secondary" disabled={busy} onClick={() => void save('DRAFT')}>Lưu nháp</Button><Button type="submit" loading={busy}>{busy ? 'Đang lưu…' : 'Đăng yêu cầu →'}</Button></div>}
        {isFinal && <p className="notice">Yêu cầu đã kết thúc nên chỉ có thể xem.</p>}
      </form>
      <aside className="panel preview-panel"><span className="eyebrow">Xem trước yêu cầu</span><h2>{draft.title || 'Nhu cầu nông sản'}</h2>
        <div className="preview-cover">✳ <span>{draft.title || 'Tên nông sản'}</span></div>
        <dl><div><dt>Khối lượng</dt><dd>{Number(draft.tonnes) > 0 ? formatTonnes(Number(draft.tonnes) * 1000) : '—'}</dd></div>
          <div><dt>Giá mong muốn</dt><dd>{price(draft.minPrice) > 0 && price(draft.maxPrice) > 0 ? `${formatMoney(price(draft.minPrice))} – ${formatMoney(price(draft.maxPrice))}` : '—'}</dd></div>
          <div><dt>Khu vực dự kiến</dt><dd>{draft.provinces || 'Chưa khai báo'}</dd></div>
          <div><dt>Đóng gói</dt><dd>{draft.packaging || 'Chưa chọn'}</dd></div></dl>
        <p className="muted">Dữ liệu sẽ hiển thị cho nhà vườn khi trạng thái là Đang mở.</p></aside>
    </div>}</>;
}
