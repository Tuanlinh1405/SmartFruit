import type { BuyRequest, Lot } from '../../lib/domain.ts';
import { compareNameMatches, createNameMatcher, productSearchText,
  type NameMatch, type ProductCatalog } from './name-match.ts';
export { normalizeSearchText } from './name-match.ts';

export type ScoringRequest = Pick<BuyRequest, 'id' | 'status' | 'fruit_type_id' | 'variety_id' | 'target_quantity_kg' | 'min_lot_quantity_kg' | 'allow_partial' | 'min_price_vnd_per_kg' | 'max_price_vnd_per_kg' | 'required_start' | 'required_end' | 'preferred_provinces'>;

export const RULE_VERSION = 'e5-top20-name-rerank-v2';
export type MatchMode = 'hybrid' | 'rule-only' | 'degraded';
export interface BusinessScore {
  eligible: boolean;
  exclusions: string[];
  priceFit: number;
  quantityFit: number;
  contributionKg: number;
  remainingKg: number;
  reasons: string[];
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const finitePositive = (value: number) => Number.isFinite(value) && value > 0;

export function scoreBusiness(lot: Lot, request: ScoringRequest): BusinessScore {
  const exclusions: string[] = [];
  if (lot.status !== 'PUBLISHED') exclusions.push('Lô chưa được công bố.');
  if (!['OPEN', 'DRAFT'].includes(request.status)) exclusions.push('Nhu cầu không còn mở.');
  if (lot.fruit_type_id !== request.fruit_type_id) exclusions.push('Khác loại nông sản.');
  if (request.variety_id && lot.variety_id !== request.variety_id) exclusions.push('Khác giống nông sản.');
  if (!lot.harvest_start || !lot.harvest_end || !request.required_start || !request.required_end ||
      lot.harvest_start > request.required_end || lot.harvest_end < request.required_start) {
    exclusions.push('Thời gian thu hoạch không phù hợp.');
  }
  if (![lot.quantity_kg, request.target_quantity_kg, lot.price_vnd_per_kg,
      request.min_price_vnd_per_kg, request.max_price_vnd_per_kg].every(finitePositive) ||
      request.min_price_vnd_per_kg > request.max_price_vnd_per_kg) {
    exclusions.push('Thiếu giá hoặc khối lượng hợp lệ.');
  }
  if (request.min_lot_quantity_kg != null && lot.quantity_kg < request.min_lot_quantity_kg) {
    exclusions.push('Lô nhỏ hơn lượng tối thiểu.');
  }
  if (!request.allow_partial && lot.quantity_kg < request.target_quantity_kg) {
    exclusions.push('Nhu cầu yêu cầu một lô đáp ứng đủ khối lượng.');
  }

  let priceFit = 0;
  if (finitePositive(lot.price_vnd_per_kg) && finitePositive(request.min_price_vnd_per_kg) &&
      finitePositive(request.max_price_vnd_per_kg)) {
    const price = lot.price_vnd_per_kg;
    const min = request.min_price_vnd_per_kg;
    const max = request.max_price_vnd_per_kg;
    priceFit = price < min ? clamp(1 - (min - price) / (0.2 * min))
      : price > max ? clamp(1 - (price - max) / (0.2 * max)) : 1;
  }
  const quantityFit = finitePositive(request.target_quantity_kg)
    ? clamp(lot.quantity_kg / request.target_quantity_kg) : 0;
  const contributionKg = Math.min(lot.quantity_kg, request.target_quantity_kg);
  const remainingKg = Math.max(request.target_quantity_kg - lot.quantity_kg, 0);
  const reasons = [
    priceFit === 1 ? 'Giá nằm trong khoảng mong muốn.' : 'Giá ngoài khoảng mong muốn, cần thương lượng.',
    remainingKg === 0 ? 'Lô đáp ứng đủ lượng mục tiêu.' : `Lô đóng góp ${contributionKg / 1000} tấn; còn thiếu ${remainingKg / 1000} tấn.`,
  ];
  return { eligible: exclusions.length === 0, exclusions, priceFit, quantityFit,
    contributionKg, remainingKg, reasons };
}

export function baselineScore(business: BusinessScore): number {
  // Renormalize the existing price/quantity weights after deferring geography.
  return business.eligible ? 100 * (0.4 * business.priceFit + 0.35 * business.quantityFit) / 0.75 : 0;
}

export interface Candidate {
  lot: Lot;
  cosineSimilarity?: number;
  graphPaths?: string[];
}

export interface RequestCandidate<T extends ScoringRequest & { title: string } = BuyRequest> {
  request: T;
  cosineSimilarity?: number;
  graphPaths?: string[];
}

export interface MatchResult {
  lot: Lot;
  score: number;
  rawScore: number;
  relevance: number | null;
  cosineSimilarity: number | null;
  business: BusinessScore;
  nameMatch: NameMatch;
  graphPaths: string[];
  mode: MatchMode;
  ruleVersion: string;
}

function scorePair(business: BusinessScore, cosineSimilarity: number | undefined, mode: MatchMode) {
  const relevance = mode === 'hybrid' && cosineSimilarity !== undefined && Number.isFinite(cosineSimilarity)
    ? clamp(cosineSimilarity) : null;
  const rawScore = relevance === null ? baselineScore(business)
    : 100 * (0.45 * relevance + 0.25 * business.priceFit +
      0.2 * business.quantityFit) / 0.9;
  return { relevance, rawScore, score: Math.round(rawScore * 100) / 100,
    cosineSimilarity: relevance === null ? null : cosineSimilarity! };
}

export interface MatchOptions { text?: string; catalog?: ProductCatalog }

export function rankMatches(candidates: Candidate[], request: BuyRequest, mode: MatchMode,
  options: MatchOptions = {}): MatchResult[] {
  const queryText = options.text?.trim() || productSearchText(request, options.catalog);
  const matchName = createNameMatcher(queryText);
  return candidates.flatMap(candidate => {
    const business = scoreBusiness(candidate.lot, request);
    if (!business.eligible) return [];
    const candidateText = productSearchText(candidate.lot, options.catalog);
    const nameMatch = matchName(candidateText);
    if (nameMatch.kind === 'excluded' || createNameMatcher(candidateText)(queryText).kind === 'excluded') return [];
    const { relevance, rawScore, score, cosineSimilarity } = scorePair(business, candidate.cosineSimilarity, mode);
    return [{ lot: candidate.lot, rawScore, score,
      relevance, cosineSimilarity, business, nameMatch, graphPaths: candidate.graphPaths ?? [], mode, ruleVersion: RULE_VERSION }];
  }).sort((a, b) => compareNameMatches(a.nameMatch, b.nameMatch) ||
    b.rawScore - a.rawScore || a.lot.id.localeCompare(b.lot.id));
}

export interface RequestMatchResult<T extends ScoringRequest & { title: string } = BuyRequest> extends Omit<MatchResult, 'lot'> {
  request: T;
}

export function rankRequestMatches<T extends ScoringRequest & { title: string }>(candidates: RequestCandidate<T>[], lot: Lot,
  mode: MatchMode, options: MatchOptions = {}): RequestMatchResult<T>[] {
  const queryText = options.text?.trim() || productSearchText(lot, options.catalog);
  const matchName = createNameMatcher(queryText);
  return candidates.flatMap(candidate => {
    const business = scoreBusiness(lot, candidate.request);
    if (!business.eligible || candidate.request.status !== 'OPEN') return [];
    const candidateText = productSearchText(candidate.request, options.catalog);
    const nameMatch = matchName(candidateText);
    if (nameMatch.kind === 'excluded' || createNameMatcher(candidateText)(queryText).kind === 'excluded') return [];
    const { relevance, rawScore, score, cosineSimilarity } = scorePair(business, candidate.cosineSimilarity, mode);
    return [{ request: candidate.request, rawScore, score, relevance, cosineSimilarity, business, nameMatch,
      graphPaths: candidate.graphPaths ?? [], mode, ruleVersion: RULE_VERSION }];
  }).sort((a, b) => compareNameMatches(a.nameMatch, b.nameMatch) ||
    b.rawScore - a.rawScore || a.request.id.localeCompare(b.request.id));
}

export function lexicalRank(lots: Lot[], searchText: string, catalog?: ProductCatalog): Map<string, number> {
  if (!searchText.trim()) return new Map();
  const matchName = createNameMatcher(searchText);
  return new Map(lots.map(lot => {
    return { id: lot.id, nameMatch: matchName(productSearchText(lot, catalog)) };
  }).filter(row => ['exact', 'fuzzy', 'partial', 'unspecified'].includes(row.nameMatch.kind))
    .sort((a, b) => compareNameMatches(a.nameMatch, b.nameMatch) || a.id.localeCompare(b.id))
    .map((row, index) => [row.id, index + 1]));
}
