import type { BuyRequest, Lot } from '../../lib/domain.ts';

export const RULE_VERSION = 'hybrid-v1-proposed';
export type MatchMode = 'hybrid' | 'rule-only' | 'degraded';
export interface BusinessScore {
  eligible: boolean;
  exclusions: string[];
  priceFit: number;
  quantityFit: number;
  locationFit: number;
  contributionKg: number;
  remainingKg: number;
  reasons: string[];
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const finitePositive = (value: number) => Number.isFinite(value) && value > 0;

export function scoreBusiness(lot: Lot, request: BuyRequest): BusinessScore {
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
  const locationFit = request.preferred_provinces.length === 0 ||
    request.preferred_provinces.includes(lot.province) ? 1 : 0;
  const contributionKg = Math.min(lot.quantity_kg, request.target_quantity_kg);
  const remainingKg = Math.max(request.target_quantity_kg - lot.quantity_kg, 0);
  const reasons = [
    priceFit === 1 ? 'Giá nằm trong khoảng mong muốn.' : 'Giá ngoài khoảng mong muốn, cần thương lượng.',
    remainingKg === 0 ? 'Lô đáp ứng đủ lượng mục tiêu.' : `Lô đóng góp ${contributionKg / 1000} tấn; còn thiếu ${remainingKg / 1000} tấn.`,
    locationFit === 1 ? 'Đúng khu vực ưu tiên hoặc không giới hạn khu vực.' : 'Ngoài tỉnh ưu tiên.',
  ];
  return { eligible: exclusions.length === 0, exclusions, priceFit, quantityFit, locationFit,
    contributionKg, remainingKg, reasons };
}

export function baselineScore(business: BusinessScore): number {
  return business.eligible ? 100 * (0.4 * business.priceFit + 0.35 * business.quantityFit +
    0.25 * business.locationFit) : 0;
}

export interface Candidate {
  lot: Lot;
  semanticRank?: number;
  lexicalRank?: number;
  graphPaths?: string[];
}

export interface RequestCandidate {
  request: BuyRequest;
  semanticRank?: number;
  lexicalRank?: number;
  graphPaths?: string[];
}

export interface MatchResult {
  lot: Lot;
  score: number;
  rawScore: number;
  relevance: number | null;
  business: BusinessScore;
  graphPaths: string[];
  mode: MatchMode;
  ruleVersion: string;
}

function scorePair(business: BusinessScore, semanticRank: number | undefined,
  lexicalRank: number | undefined, mode: MatchMode) {
  const semantic = semanticRank && semanticRank > 0 ? 1 / (60 + semanticRank) : 0;
  const lexical = lexicalRank && lexicalRank > 0 ? 1 / (60 + lexicalRank) : 0;
  const relevance = mode === 'hybrid' ? clamp((semantic + lexical) / (2 / 61)) : null;
  const rawScore = relevance === null ? baselineScore(business)
    : 100 * (0.45 * relevance + 0.25 * business.priceFit +
      0.2 * business.quantityFit + 0.1 * business.locationFit);
  return { relevance, rawScore, score: Math.round(rawScore * 100) / 100 };
}

export function rankMatches(candidates: Candidate[], request: BuyRequest, mode: MatchMode): MatchResult[] {
  return candidates.flatMap(candidate => {
    const business = scoreBusiness(candidate.lot, request);
    if (!business.eligible) return [];
    const { relevance, rawScore, score } = scorePair(business, candidate.semanticRank,
      candidate.lexicalRank, mode);
    return [{ lot: candidate.lot, rawScore, score,
      relevance, business, graphPaths: candidate.graphPaths ?? [], mode, ruleVersion: RULE_VERSION }];
  }).sort((a, b) => b.rawScore - a.rawScore || a.lot.id.localeCompare(b.lot.id));
}

export interface RequestMatchResult extends Omit<MatchResult, 'lot'> {
  request: BuyRequest;
}

export function rankRequestMatches(candidates: RequestCandidate[], lot: Lot,
  mode: MatchMode): RequestMatchResult[] {
  return candidates.flatMap(candidate => {
    const business = scoreBusiness(lot, candidate.request);
    if (!business.eligible || candidate.request.status !== 'OPEN') return [];
    const { relevance, rawScore, score } = scorePair(business, candidate.semanticRank,
      candidate.lexicalRank, mode);
    return [{ request: candidate.request, rawScore, score, relevance, business,
      graphPaths: candidate.graphPaths ?? [], mode, ruleVersion: RULE_VERSION }];
  }).sort((a, b) => b.rawScore - a.rawScore || a.request.id.localeCompare(b.request.id));
}

export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
}

export function lexicalRank(lots: Lot[], searchText: string): Map<string, number> {
  const needle = normalizeSearchText(searchText);
  if (!needle) return new Map();
  const tokens = needle.split(' ').filter(Boolean);
  return new Map(lots.map(lot => {
    const haystack = normalizeSearchText(`${lot.title} ${lot.description} ${lot.grade ?? ''}`);
    const hits = tokens.filter(token => haystack.includes(token)).length;
    return { id: lot.id, hits };
  }).filter(row => row.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.id.localeCompare(b.id))
    .map((row, index) => [row.id, index + 1]));
}
