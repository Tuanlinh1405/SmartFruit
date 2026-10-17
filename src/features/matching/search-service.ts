import type { BuyRequest, Lot } from '../../lib/domain.ts';
import { rankMatches, rankRequestMatches, RULE_VERSION, type MatchMode } from './core.ts';
import { productSearchText, type ProductCatalog } from './name-match.ts';
import { EMBEDDING_MODEL, VECTOR_TOP_K } from './embedding-config.ts';

export type SearchDirection = 'buyer-to-lots' | 'farmer-to-requests';
export interface SearchInput {
  direction: SearchDirection;
  sourceId: string;
  text: string;
  page: number;
  pageSize: number;
}
export interface CandidateRow {
  id: string;
  cosineSimilarity?: number;
  graphPaths?: string[];
  eligibleCount: number;
  truncated: boolean;
}
export interface SearchRepository {
  catalog?(): Promise<ProductCatalog>;
  getBuyerRequest(id: string, userId: string): Promise<BuyRequest | null>;
  getFarmerLot(id: string, userId: string): Promise<Lot | null>;
  lotCandidates(id: string, embedding: number[] | null, text: string): Promise<CandidateRow[]>;
  requestCandidates(id: string, embedding: number[] | null, text: string): Promise<CandidateRow[]>;
  lots(ids: string[]): Promise<Lot[]>;
  requests(ids: string[]): Promise<BuyRequest[]>;
}
export interface EmbeddingProvider { query(text: string): Promise<number[]> }

export class SearchAccessError extends Error {}

export async function searchMatches(input: SearchInput, userId: string,
  repository: SearchRepository, embeddingProvider?: EmbeddingProvider) {
  const buyer = input.direction === 'buyer-to-lots';
  const request = buyer ? await repository.getBuyerRequest(input.sourceId, userId) : null;
  const lot = buyer ? null : await repository.getFarmerLot(input.sourceId, userId);
  if (!request && !lot) throw new SearchAccessError('Nguồn tìm kiếm không tồn tại hoặc không thuộc tài khoản.');
  const catalog = await repository.catalog?.();
  const text = input.text.trim() || productSearchText(request ?? lot!, catalog);
  let vector: number[] | null = null;
  if (embeddingProvider) {
    try {
      vector = await embeddingProvider.query(text);
      if (vector.length !== EMBEDDING_MODEL.dimensions || vector.some(value => !Number.isFinite(value)) ||
          !vector.some(value => value !== 0)) vector = null;
    } catch { vector = null; }
  }
  const retrieved = buyer
    ? await repository.lotCandidates(input.sourceId, vector, text)
    : await repository.requestCandidates(input.sourceId, vector, text);
  const hasSemantic = vector !== null;
  const mode: MatchMode = hasSemantic ? 'hybrid' : 'degraded';
  // Vector retrieval is the only source of hybrid candidates. Cap BEFORE loading/reranking.
  // Do not backfill excluded/stale results with records outside the vector top 20.
  const unique = new Map<string, CandidateRow>();
  for (const row of retrieved) {
    if (hasSemantic && (row.cosineSimilarity === undefined || !Number.isFinite(row.cosineSimilarity) ||
        row.cosineSimilarity < -1 || row.cosineSimilarity > 1)) continue;
    const previous = unique.get(row.id);
    if (!previous || (row.cosineSimilarity ?? -1) > (previous.cosineSimilarity ?? -1)) unique.set(row.id, row);
  }
  const candidates = hasSemantic ? [...unique.values()]
    .sort((a, b) => b.cosineSimilarity! - a.cosineSimilarity! || a.id.localeCompare(b.id))
    .slice(0, VECTOR_TOP_K) : [...unique.values()];
  // Fetch by ID under caller RLS, then recheck all hard conditions in the scoring core.
  // This prevents a stale candidate list from returning a newly closed source row.
  const rowsById = new Map(candidates.map(row => [row.id, row]));
  const records = buyer ? await repository.lots([...rowsById.keys()])
    : await repository.requests([...rowsById.keys()]);
  const scored = buyer
    ? rankMatches((records as Lot[]).map(item => ({
      lot: item, cosineSimilarity: rowsById.get(item.id)?.cosineSimilarity,
      graphPaths: rowsById.get(item.id)?.graphPaths ??
        [request!.variety_id ? 'Nhu cầu → giống → lô' : 'Nhu cầu → loại nông sản → lô'],
    })).filter(item => rowsById.has(item.lot.id)), request!, mode, { text, catalog })
    : rankRequestMatches((records as BuyRequest[]).map(item => ({
      request: item, cosineSimilarity: rowsById.get(item.id)?.cosineSimilarity,
      graphPaths: rowsById.get(item.id)?.graphPaths ??
        [item.variety_id ? 'Lô → giống → nhu cầu' : 'Lô → loại nông sản → nhu cầu'],
    })).filter(item => rowsById.has(item.request.id)), lot!, mode, { text, catalog });
  const offset = (input.page - 1) * input.pageSize;
  return {
    items: scored.slice(offset, offset + input.pageSize),
    meta: {
      mode, ruleVersion: RULE_VERSION, modelVersion: hasSemantic ? EMBEDDING_MODEL.version : null,
      rankingScope: hasSemantic ? 'vector_top20' : candidates[0]?.truncated ? 'candidate_pool' : 'all_eligible',
      truncated: (retrieved[0]?.eligibleCount ?? 0) > candidates.length || (retrieved[0]?.truncated ?? false),
      candidateCount: candidates.length, eligibleCount: retrieved[0]?.eligibleCount ?? 0,
      resultCount: scored.length, page: input.page, pageSize: input.pageSize,
      generatedAt: new Date().toISOString(),
    },
  };
}
