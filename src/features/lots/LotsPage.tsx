import { useQuery } from '@tanstack/react-query';
import { ProductPhoto } from '../../components/shared/product-photo';
import './product-photos.css';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { BuyRequest, FruitType, FruitVariety, Lot, MarketplaceProfile } from '../../lib/domain';
import { tradeLabels } from '../../lib/domain';
import { explainError, formatDate, formatMoney, formatTonnes } from '../../lib/format';
import { loadCatalog } from '../catalog/api';
import { listMyRequests } from '../buy-requests/api';
import { lexicalRank, rankMatches } from '../matching/core';
import { createNameMatcher, productSearchText } from '../matching/name-match';
import { searchBuyerMatches, type MatchResponse } from '../matching/api';
import { getPublishedLot, loadFarmerCards, loadLotPhotos, loadPublishedLots } from './api';
import { openConnection } from '../trading/api';
import { Modal } from '../../components/ui/dialog';

import { LoadingSteps, LoadingState } from '../../components/shared';

type LotCard = { lot: Lot; score: number | null; reasons: string[] };
const hybridEnabled = import.meta.env.VITE_MATCHING_MODE === 'hybrid';

export function LotsPage() {
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const requestId = params.get('requestId') ?? '';
  const keyword = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') || '1') || 1);
  const [requests, setRequests] = useState<BuyRequest[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [farmers, setFarmers] = useState<Record<string, MarketplaceProfile>>({});
  const [types, setTypes] = useState<FruitType[]>([]);
  const [varieties, setVarieties] = useState<FruitVariety[]>([]);
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [tooMany, setTooMany] = useState(false);
  const [hybridResponse, setHybridResponse] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = requests.find(item => item.id === requestId);

  useEffect(() => {
    let active = true;
    if (!session) return;
    Promise.all([listMyRequests(session.user.id), loadCatalog()]).then(([myRequests, catalog]) => {
      if (!active) return;
      setRequests(myRequests); setTypes(catalog.types); setVarieties(catalog.varieties);
    }).catch(cause => { if (active) setError(explainError(cause)); });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const fruitId = requestId ? request?.fruit_type_id : undefined;
    if (requestId && !request) { setLoading(false); return () => { active = false; }; }
    const loadRuleOnly = async () => {
      const result = await loadPublishedLots(fruitId);
      const identities = await loadFarmerCards(result.lots.map(lot => lot.farmer_id));
      if (!active) return;
      setHybridResponse(null); setLots(result.lots); setFarmers(identities); setTooMany(result.tooMany);
    };
    const load = async () => {
      try {
        if (hybridEnabled && request) {
          const result = await searchBuyerMatches(request.id, keyword, page);
          const identities = await loadFarmerCards(result.items.map(row => row.lot.farmer_id));
          if (!active) return;
          setHybridResponse(result); setLots(result.items.map(row => row.lot));
          setFarmers(identities); setTooMany(false);
        } else await loadRuleOnly();
      } catch (cause) {
        if (!active) return;
        if (hybridEnabled && request) {
          try {
            await loadRuleOnly();
            if (active) setError('Dịch vụ tìm kiếm tạm gián đoạn; đang hiển thị kết quả thay thế.');
          } catch (fallbackError) { if (active) setError(explainError(fallbackError)); }
        } else setError(explainError(cause));
      } finally { if (active) setLoading(false); }
    };
    const timer = window.setTimeout(load, hybridEnabled && request ? 300 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [requestId, request?.fruit_type_id, requests.length, hybridEnabled && requestId ? keyword : '',
    hybridEnabled && requestId ? page : 1]);

  function changeParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }

  const cards = useMemo<LotCard[]>(() => {
    if (hybridResponse) return hybridResponse.items.map(row => ({ lot: row.lot,
      score: row.score, reasons: [row.nameMatch?.reason ?? '',
        row.cosineSimilarity == null ? '' : `Cosine E5: ${row.cosineSimilarity.toFixed(4)}.`,
        ...row.graphPaths, ...row.business.reasons].filter(Boolean) }));
    if (tooMany) return [];
    const catalog = { types, varieties };
    const ranks = lexicalRank(lots, keyword, catalog);
    const pool = keyword.trim() ? lots.filter(lot => ranks.has(lot.id)) : lots;
    if (request && ['OPEN', 'DRAFT'].includes(request.status)) {
      // Explicit fallback until the vector/graph search endpoint is deployed.
      return rankMatches(pool.map(lot => ({ lot })), request, 'rule-only', { text: keyword, catalog })
        .map(row => ({ lot: row.lot, score: row.score, reasons: [row.nameMatch.reason, ...row.business.reasons] }));
    }
    const matchName = createNameMatcher(keyword);
    return [...pool].sort((a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0))
      .map(lot => ({ lot, score: null,
        reasons: keyword.trim() ? [matchName(productSearchText(lot, catalog)).reason] : [] }));
  }, [lots, keyword, request, tooMany, hybridResponse, types, varieties]);
  const resultCount = hybridResponse?.meta.resultCount ?? cards.length;
  const totalPages = Math.max(1, Math.ceil(resultCount / 12));
  const visible = hybridResponse ? cards : cards.slice((Math.min(page, totalPages) - 1) * 12,
    Math.min(page, totalPages) * 12);
  const photoIds = visible.map(card => card.lot.id);
  const photos = useQuery({queryKey: ['buyer-lot-photos', session?.user.id, photoIds],
    enabled: !!session && photoIds.length > 0, queryFn: () => loadLotPhotos(photoIds),
    retry: false, staleTime: 30_000, refetchInterval: 45_000});
  const fruitName = (lot: Lot) => [types.find(item => item.id === lot.fruit_type_id)?.name,
    varieties.find(item => item.id === lot.variety_id)?.name].filter(Boolean).join(' · ');

  return <><div className="page-heading"><div><span className="eyebrow">Nguồn cung nông sản</span><h1>Tìm kiếm lô hàng</h1><p>Khám phá các lô đã công bố và đối chiếu với nhu cầu của bạn.</p></div>
    <Link className="button accent" to="/buyer/requests/new">Tạo yêu cầu</Link></div>
    <section className="panel search-panel"><div className="search-fields">
      <label>Nhu cầu đang đối chiếu<select value={requestId} onChange={e => changeParam('requestId', e.target.value)}>
        <option value="">Duyệt tất cả lô</option>{requests.filter(row => ['OPEN', 'DRAFT'].includes(row.status)).map(row =>
          <option key={row.id} value={row.id}>{row.title} {row.status === 'DRAFT' ? '(nháp)' : ''}</option>)}</select></label>
      <label>Tìm theo từ khóa<input type="search" placeholder="Tên nông sản, giống…" maxLength={200} value={keyword}
        onChange={e => changeParam('q', e.target.value)} /></label></div>
      {requestId && !request && <p className="form-error">Nhu cầu chưa tải xong hoặc không thuộc tài khoản của bạn.</p>}
      {request?.status === 'DRAFT' && <p className="notice">Đang xem trước với nhu cầu nháp; nhà vườn chưa thấy yêu cầu này.</p>}

    </section>
    {error && <div className="notice error" role="alert">{error}</div>}
    {loading ? requestId ? <LoadingSteps label="Đang tìm lô hàng phù hợp…" /> : <LoadingState /> : tooMany ?
      <div className="panel empty-state"><h2>Quá nhiều lô để xếp hạng đầy đủ</h2><p>Hãy chọn nhu cầu hoặc thêm điều kiện để thu hẹp tập lô.</p></div> :
      <><div className="results-heading"><div><h2>{request ? 'Lô phù hợp với nhu cầu' : 'Lô hàng đang bán'}</h2><p>{resultCount} lô trong tập kết quả</p></div>
        {request && <span className="status-pill">{hybridResponse?.meta.mode === 'hybrid'
          ? 'Xếp hạng kết hợp' : hybridResponse ? 'Tìm kiếm dự phòng' : 'Xếp hạng theo quy tắc'}</span>}</div>
      {cards.length === 0 ? <div className="panel empty-state"><div className="empty-icon">⌕</div><h2>Chưa có lô phù hợp</h2><p>Thử đổi từ khóa hoặc chọn một nhu cầu khác.</p></div> :
        <div className="lot-list">{visible.map(({ lot, score, reasons }) => <article className="panel lot-card" key={lot.id}>
          <div className="lot-thumb"><ProductPhoto photo={photos.data?.[lot.id]?.[0]} alt={lot.title} loading={photos.isFetching && !photos.data} onRetry={() => { void photos.refetch(); }} /></div><div className="lot-main"><span className="eyebrow">{fruitName(lot)}</span><h3>{lot.title}</h3>
            <p>{farmers[lot.farmer_id]?.display_name || 'Nhà vườn'} · {lot.province}{lot.district ? `, ${lot.district}` : ''}</p>
            <div className="chip-row">{lot.certifications.map(item => <span className="chip green" key={item}>{item} · tự khai</span>)}
              {lot.packaging_options.map(item => <span className="chip" key={item}>{item}</span>)}</div></div>
          <div className="lot-facts"><span><small>Sản lượng</small><strong>{formatTonnes(lot.quantity_kg)}</strong></span>
            <span><small>Giá</small><strong>{formatMoney(lot.price_vnd_per_kg)}</strong></span>
            <span><small>Thu hoạch</small><strong>{formatDate(lot.harvest_start)} – {formatDate(lot.harvest_end)}</strong></span></div>
          <div className="lot-actions">{score !== null && <span className="match-pill">{score.toFixed(1)}% phù hợp</span>}
            <button className="button primary" onClick={() => setSelectedLot(lot.id)}>Xem chi tiết</button>
            </div>
        </article>)}</div>}
      {totalPages > 1 && <div className="pagination"><button className="button outline" disabled={page <= 1} onClick={() => changeParam('page', String(page - 1))}>← Trước</button>
        <span>Trang {Math.min(page, totalPages)} / {totalPages}</span><button className="button outline" disabled={page >= totalPages} onClick={() => changeParam('page', String(page + 1))}>Tiếp →</button></div>}</>}
    {selectedLot && <LotDetail id={selectedLot} request={request} farmer={farmers[lots.find(item => item.id === selectedLot)?.farmer_id ?? '']} onClose={() => setSelectedLot(null)} />}
  </>;
}

function LotDetail({ id, request, farmer, onClose }: { id: string; request?: BuyRequest; farmer?: MarketplaceProfile; onClose: () => void }) {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [lot, setLot] = useState<Lot | null>(null);
  const { session } = useAuth();
  const imageQuery = useQuery({queryKey: ['buyer-lot-photos', session?.user.id, [id]],
    enabled: !!lot, queryFn: () => loadLotPhotos([id]), retry: false,
    staleTime: 30_000, refetchInterval: 45_000});
  const images = imageQuery.data?.[id] ?? [];
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getPublishedLot(id).then(data => {
      if (!active) return;
      if (!data) { setError('Lô hàng không còn khả dụng.'); return; }
      setLot(data);
    }).catch(cause => { if (active) setError(explainError(cause)); });
    return () => { active = false; };
  }, [id]);
  return <Modal open title={lot?.title || 'Chi tiết lô nông sản'} description={`${farmer?.display_name || 'Nhà vườn'} · Chi tiết lô nông sản`} className="lot-dialog" onOpenChange={open=>{if(!open)onClose();}}>
      {error && <p className="form-error" role="alert">{error}</p>}
      {lot && <><div className="modal-body"><div className="detail-grid"><div><small>Sản lượng</small><strong>{formatTonnes(lot.quantity_kg)}</strong></div>
        <div><small>Giá chào</small><strong>{formatMoney(lot.price_vnd_per_kg)}</strong></div>
        <div><small>Thu hoạch</small><strong>{formatDate(lot.harvest_start)} – {formatDate(lot.harvest_end)}</strong></div>
        <div><small>Khu vực</small><strong>{lot.province}</strong></div>
        <div><small>Hình thức bán</small><strong>{tradeLabels[lot.selling_method]}</strong></div>
        <div><small>Phân loại</small><strong>{lot.grade || 'Chưa khai báo'}</strong></div></div>
        <h3>Mô tả nhà vườn</h3><p>{lot.description || 'Chưa có mô tả.'}</p>
        <div className="chip-row">{lot.certifications.map(item => <span className="chip green" key={item}>{item} · nhà vườn tự khai</span>)}
          {lot.packaging_options.map(item => <span className="chip" key={item}>{item}</span>)}</div>
        {images.length > 0 && <div className="image-grid">{images.map(photo => <ProductPhoto photo={photo} alt={lot.title} key={photo.url} />)}</div>}
        {images.length === 0 && <div className="image-placeholder">{imageQuery.isFetching ? 'Đang tải ảnh sản phẩm…' : 'Chưa tải được ảnh sản phẩm.'}<button className="button outline" onClick={() => { void imageQuery.refetch(); }}>Tải lại ảnh</button></div>}
      </div><div className="modal-footer"><button className="button outline" onClick={onClose}>Đóng</button>
        <button className="button accent" disabled={connecting || Boolean(request && request.status !== 'OPEN')} onClick={async () => {
          setConnecting(true); setError(''); try { const connectionId = await openConnection(lot.id, request?.id);
            navigate(`/buyer/invitations?connectionId=${connectionId}`); } catch(cause) { setError(explainError(cause)); } finally { setConnecting(false); }
        }}>{connecting ? 'Đang gửi…' : request && request.status !== 'OPEN' ? 'Cần công bố nhu cầu trước' : 'Gửi lời mời kết nối →'}</button></div></>}
    </Modal>;
}
