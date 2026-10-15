import type { BuyRequest, Lot } from '../../lib/domain.ts';
import { rankMatches, rankRequestMatches, RULE_VERSION, type MatchMode } from './core.ts';

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
  semanticRank?: number;
  lexicalRank?: number;
  graphPaths?: string[];
  eligibleCount: number;
  truncated: boolean;
}
export interface SearchRepository {
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
  const text = input.text.trim() || (request ? `${request.title} ${request.notes}` :
    `${lot?.title} ${lot?.description}`);
  let vector: number[] | null = null;
  if (embeddingProvider) {
    try {
      vector = await embeddingProvider.query(text);
      if (vector.length !== 768 || vector.some(value => !Number.isFinite(value))) vector = null;
    } catch { vector = null; }
  }
  const candidates = buyer
    ? await repository.lotCandidates(input.sourceId, vector, text)
    : await repository.requestCandidates(input.sourceId, vector, text);
  const hasSemantic = vector !== null && candidates.some(row => row.semanticRank !== undefined);
  const mode: MatchMode = hasSemantic ? 'hybrid' : 'degraded';
  // Fetch by ID under caller RLS, then recheck all hard conditions in the scoring core.
  // This prevents a stale candidate list from returning a newly closed source row.
  const rowsById = new Map(candidates.map(row => [row.id, row]));
  const records = buyer ? await repository.lots([...rowsById.keys()])
    : await repository.requests([...rowsById.keys()]);
  const scored = buyer
    ? rankMatches((records as Lot[]).map(item => ({
      lot: item, semanticRank: rowsById.get(item.id)?.semanticRank,
      lexicalRank: rowsById.get(item.id)?.lexicalRank,
      graphPaths: rowsById.get(item.id)?.graphPaths ??
        [request!.variety_id ? 'Nhu cầu → giống → lô' : 'Nhu cầu → loại nông sản → lô'],
    })), request!, mode)
    : rankRequestMatches((records as BuyRequest[]).map(item => ({
      request: item, semanticRank: rowsById.get(item.id)?.semanticRank,
      lexicalRank: rowsById.get(item.id)?.lexicalRank,
      graphPaths: rowsById.get(item.id)?.graphPaths ??
        [item.variety_id ? 'Lô → giống → nhu cầu' : 'Lô → loại nông sản → nhu cầu'],
    })), lot!, mode);
  const offset = (input.page - 1) * input.pageSize;
  return {
    items: scored.slice(offset, offset + input.pageSize),
    meta: {
      mode, ruleVersion: RULE_VERSION, modelVersion: hasSemantic ? 'multilingual-e5-base-v1' : null,
      rankingScope: candidates[0]?.truncated ? 'candidate_pool' : 'all_eligible',
      truncated: candidates[0]?.truncated ?? false,
      candidateCount: candidates[0]?.eligibleCount ?? 0,
      resultCount: scored.length, page: input.page, pageSize: input.pageSize,
      generatedAt: new Date().toISOString(),
    },
  };
}
