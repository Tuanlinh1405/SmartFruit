import { supabase } from '../../../lib/supabase';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Card, EmptyState, ErrorState, LoadingState, LoadingSteps, PageHeader } from '../../../components/shared';
import { Select } from '../../../components/ui';
import type { Lot } from '../lots/lot.model';
import { lotColumns } from '../lots/lot.api';
import { explainError } from '../../../lib/format';
import { searchFarmerCandidates, type FarmerSearchResult } from './hybrid-search';

export type BuyCandidate = import('../../matching/core').ScoringRequest & { buyer_id: string; title: string };
export interface MatchResult { lotId: string; requestId: string; score: number; reasons: string[]; missingInformation: string[]; ruleVersion: string; suggestedQuantityKg?: number; cosineSimilarity?: number | null; }
export type MatchScorer = (lot: Lot, requests: BuyCandidate[]) => MatchResult[] | Promise<MatchResult[]>;
export interface FarmerMatchingRepository {
  search?(userId: string, lotId: string): Promise<FarmerSearchResult>;
  lots(userId: string): Promise<Lot[]>;
  candidates(userId: string, lotId: string): Promise<{ lot: Lot; requests: BuyCandidate[]; partners: { user_id: string; display_name: string; province: string | null }[] }>;
}
export function createFarmerMatchingRepository(client: SupabaseClient): FarmerMatchingRepository {
  async function owner(userId: string) { const auth = await client.auth.getUser(); if (auth.error || auth.data.user?.id !== userId) throw new Error('Phiên đăng nhập không hợp lệ.'); }
  const repository: FarmerMatchingRepository = {
    async search(userId, lotId) {
      await owner(userId);
      const record = await client.from('lots').select(lotColumns).eq('id', lotId).eq('farmer_id', userId).eq('status', 'PUBLISHED').single<Lot>();
      if (record.error || !record.data) throw new Error('Không truy cập được lô đang công bố.');
      return searchFarmerCandidates(client, record.data);
    },
    async lots(userId) {
      await owner(userId); const rows: Lot[] = [];
      for (let offset = 0; offset <= 1000; offset += 100) {
        const result = await client.from('lots').select(lotColumns, { count: 'exact' }).eq('farmer_id', userId).eq('status', 'PUBLISHED').order('id').range(offset, offset + 99);
        if (result.error || !result.data || result.count === null) throw new Error('Không thể tải danh sách lô.');
        if (result.count > 1000) throw new Error('Có quá nhiều lô; hãy mở matching từ một lô cụ thể.');
        rows.push(...result.data as Lot[]); if (rows.length >= result.count) break;
      }
      return rows;
    },
    async candidates(userId, lotId) {
      await owner(userId);
      const record = await client.from('lots').select(lotColumns).eq('id', lotId).eq('farmer_id', userId).eq('status', 'PUBLISHED').maybeSingle<Lot>();
      if (record.error || !record.data) throw new Error('Không truy cập được lô hoặc lô chưa được công bố.');
      const lot = record.data; const requests: BuyCandidate[] = [];
      for (let offset = 0; offset <= 1000; offset += 100) {
        const result = await client.from('buy_requests').select('id,status,buyer_id,fruit_type_id,variety_id,title,target_quantity_kg,min_lot_quantity_kg,allow_partial,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end,preferred_provinces', { count: 'exact' })
          .eq('status', 'OPEN').eq('fruit_type_id', lot.fruit_type_id).lte('required_start', lot.harvest_end).gte('required_end', lot.harvest_start).order('id').range(offset, offset + 99);
        if (result.error || !result.data || result.count === null) throw new Error('Không thể tải nhu cầu thu mua.');
        if (result.count > 1000) throw new Error('Quá nhiều ứng viên. Hãy thu hẹp loại quả/ngày thu hoạch trước khi matching.');
        requests.push(...result.data as BuyCandidate[]); if (requests.length >= result.count) break;
      }
      const buyers = [...new Set(requests.map(r => r.buyer_id))]; const partners: { user_id: string; display_name: string; province: string | null }[] = [];
      for (let i = 0; i < buyers.length; i += 100) {
        const result = await client.from('marketplace_profiles').select('user_id,display_name,province').in('user_id', buyers.slice(i, i + 100));
        if (result.error || !result.data) throw new Error('Không thể tải thông tin đối tác công khai.'); partners.push(...result.data);
      }
      return { lot, requests, partners };
    },
  }; return repository;
}
async function configured() { return createFarmerMatchingRepository(supabase); }
export const farmerMatchingRepository: FarmerMatchingRepository = { search: async (u, id) => (await configured()).search!(u, id), lots: async u => (await configured()).lots(u), candidates: async (u, id) => (await configured()).candidates(u, id) };
export function validateMatches(lot: Lot, requests: BuyCandidate[], matches: MatchResult[]): void {
  if (!Array.isArray(matches)) throw new Error('Kết quả matching không đúng contract.');
  const seen = new Set<string>();
  for (const result of matches) {
    if (!result || result.lotId !== lot.id || !requests.some(r => r.id === result.requestId) || seen.has(result.requestId) || !Number.isFinite(result.score) || result.score < 0 || result.score > 100 || typeof result.ruleVersion !== 'string' || !result.ruleVersion || !Array.isArray(result.reasons) || !result.reasons.every(reason => typeof reason === 'string') || !Array.isArray(result.missingInformation) || !result.missingInformation.every(info => typeof info === 'string')
      || (result.cosineSimilarity != null && (!Number.isFinite(result.cosineSimilarity) || result.cosineSimilarity < -1 || result.cosineSimilarity > 1))
      || (result.suggestedQuantityKg !== undefined && (!Number.isFinite(result.suggestedQuantityKg) || result.suggestedQuantityKg <= 0 || result.suggestedQuantityKg > lot.quantity_kg))) throw new Error('Kết quả matching không đúng contract.');
    seen.add(result.requestId);
  }
}
export function FarmerMatchingPanel(props: { authenticatedUserId: string | null; repository?: FarmerMatchingRepository; scorer?: MatchScorer; scoringVersion?: string; initialLotId?: string; onConnect: (lotId: string, requestId: string) => Promise<void> }) { return <ForUser key={props.authenticatedUserId} {...props} />; }
function ForUser({ authenticatedUserId: userId, repository = farmerMatchingRepository, scorer, scoringVersion = 'shared', initialLotId = '', onConnect }: { authenticatedUserId: string | null; repository?: FarmerMatchingRepository; scorer?: MatchScorer; scoringVersion?: string; initialLotId?: string; onConnect: (lotId: string, requestId: string) => Promise<void> }) {
  const sending = useRef(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectError, setConnectError] = useState('');
  async function connect(lotId: string, requestId: string) {
    if (sending.current) return;
    sending.current = true; setConnecting(requestId); setConnectError('');
    try { await onConnect(lotId, requestId); }
    catch (cause) { setConnectError(explainError(cause)); }
    finally { sending.current = false; setConnecting(null); }
  }
  const [id, setId] = useState(initialLotId); const [page, setPage] = useState(1);
  const lots = useQuery({ queryKey: ['farmer-matching-lots', userId], enabled: !!userId, queryFn: () => repository.lots(userId!), retry: false });
  const result = useQuery({ queryKey: ['farmer-matches', userId, id, scoringVersion], enabled: !!userId && !!id && !!scorer, retry: false, queryFn: async () => {
    let warning = '';
    if (import.meta.env.VITE_MATCHING_MODE === 'hybrid' && repository.search) {
      try {
        const data = await repository.search(userId!, id);
        validateMatches(data.lot, data.requests, data.matches);
        return { ...data, warning };
      } catch { warning = 'Tìm kiếm E5 chưa khả dụng; đang dùng so tên và quy tắc giá/lượng.'; }
    }
    const data = await repository.candidates(userId!, id); const matches = await scorer!(data.lot, data.requests); validateMatches(data.lot, data.requests, matches); return { ...data, matches, mode: 'degraded' as const, warning };
  } });
  if (!userId) return <EmptyState title="Chưa đăng nhập" />;
  return <div className="stack"><PageHeader title="Người mua phù hợp" description="Điểm gợi ý theo tiêu chí, không đảm bảo giao dịch." />
    {!scorer && <EmptyState title="Chưa có quy tắc matching dùng chung" description="Chờ module matching được bàn giao. Không hiển thị điểm mẫu như kết quả thực." />}
    {lots.isPending ? <LoadingState /> : lots.isError ? <ErrorState message="Không thể tải lô để matching." onRetry={() => { void lots.refetch(); }} /> : <Select label="Chọn lô cần matching" value={id} onChange={e => { setId(e.target.value); setPage(1); }}><option value="">Chọn lô</option>{lots.data.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</Select>}
    {connectError && <p role="alert">{connectError}</p>}
    {!id && <EmptyState title="Chưa chọn lô" />}
    {id && scorer && (result.isPending ? <LoadingSteps label="Đang tìm người mua phù hợp…" /> : result.isError ? <ErrorState message={result.error.message} onRetry={() => { void result.refetch(); }} /> : !result.data.matches.length ? <EmptyState title="Không có người mua phù hợp" description="Thử thay đổi thông tin lô hoặc ngày thu hoạch." /> : <>
      <p>{result.data.mode === 'hybrid' ? 'Đã lấy tối đa 20 nhu cầu bằng cosine E5 rồi xếp lại theo độ khớp tên.' : 'Đang dùng so tên và quy tắc giá/lượng.'}</p>
      {result.data.warning && <p role="status">{result.data.warning}</p>}
      {result.data.matches.slice((page - 1) * 20, page * 20).map(match => { const request = result.data.requests.find(r => r.id === match.requestId)!; return <Card key={match.requestId} title={result.data.partners.find(p => p.user_id === request.buyer_id)?.display_name ?? 'Đối tác thu mua'}><p>Phù hợp {match.score} điểm · Quy tắc {match.ruleVersion}</p>{match.cosineSimilarity != null && <p>Cosine E5: {match.cosineSimilarity.toFixed(4)}</p>}<ul>{match.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul><p>{request.title} · {request.allow_partial ? 'Chấp nhận một phần' : 'Yêu cầu đủ lượng'}</p><p>{match.suggestedQuantityKg !== undefined && `${match.suggestedQuantityKg} kg đề xuất`}</p><p>{match.missingInformation.join('; ')}</p><button className="button button-secondary" disabled={connecting !== null} onClick={() => { void connect(id, request.id); }}>{connecting === request.id ? 'Đang gửi…' : 'Gửi lời mời kết nối'}</button></Card>; })}
      <div className="row"><button className="button button-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Trang trước</button><p>Trang {page}</p><button className="button button-secondary" disabled={page * 20 >= result.data.matches.length} onClick={() => setPage(p => p + 1)}>Trang sau</button></div>
    </>)}
  </div>;
}
