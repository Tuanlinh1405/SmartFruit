import type { FruitType, FruitVariety } from '../../lib/domain.ts';

export interface ProductCatalog {
  types: Pick<FruitType, 'id' | 'name'>[];
  varieties: Pick<FruitVariety, 'id' | 'name'>[];
}

export interface NameMatch {
  kind: 'exact' | 'fuzzy' | 'partial' | 'none' | 'excluded' | 'unspecified';
  score: number;
  matchedTokens: string[];
  unmatchedTokens: string[];
  reason: string;
}

// Trading phrases/units carry no product identity. Cultivar names come from data, not a fixed list.
const noise = new Set(['can', 'tim', 'mua', 'thu', 'ban', 'lay', 'nhan', 'chon', 'uu', 'tien',
  'lo', 'hang', 'nong', 'san', 'qua', 'trai', 'loai', 'giong', 'khoang', 'voi', 'va', 'hoac',
  'gia', 'duoi', 'tren', 'tu', 'den', 'toi', 'da', 'thieu', 'khong', 'qua', 'vuot', 'dong',
  'vnd', 'kg', 'kilogram', 'tan', 'ton', 'tons', 'nghin', 'ngan', 'trieu', 'luong', 'khoi',
  'buy', 'buying', 'sell', 'selling', 'need', 'fruit', 'grade', 'the', 'of', 'a', 'an']);
const negativeClause = /\b(?:khong\s+(?:lay|mua|nhan|chon|phai|can)|ngoai\s+tru|loai\s+tru|tru|excluding|except|not)\s+([^,;.!?]+)/g;

export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
}

function tokens(text: string): string[] {
  // Join spaced cultivar codes, but never join units/phrases such as "giá 70000".
  const withoutAmounts = text.replace(/\b\d+(?:[.,]\d+)*\s*(?:tan|tons?|kg|kilogram|vnd|dong|nghin|ngan|trieu)\b/g, ' ');
  const joined = withoutAmounts.replace(/\b([a-z]{1,12})[\s-]+(\d+)\b/g,
    (whole, word: string, digits: string) => noise.has(word) ? whole : `${word}${digits}`);
  return [...new Set((joined.match(/[a-z0-9]+/g) ?? [])
    .filter(word => !noise.has(word) && (!/^\d+$/.test(word) || /^0\d+$/.test(word))))].slice(0, 32);
}

function parseName(value: string): { positive: string[]; excluded: string[][] } {
  const excluded: string[][] = [];
  const positive = normalizeSearchText(value.slice(0, 1000)).replace(negativeClause, (_, phrase: string) => {
    const words = tokens(phrase);
    if (words.length) excluded.push(words);
    return ' ';
  });
  return { positive: tokens(positive), excluded };
}

// Optimal string alignment distance: insertion/deletion/substitution and adjacent transposition.
function editDistance(a: string, b: string): number {
  let previousPrevious: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        current[j] = Math.min(current[j], previousPrevious[j - 2] + 1);
      }
    }
    previousPrevious = previous;
    previous = current;
  }
  return previous[b.length];
}

function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  // Short words and numeric cultivar codes are exact-only: Ri6 must not become Ri7 or RD6.
  if (/\d/.test(a + b) || Math.min(a.length, b.length) < 4 || Math.max(a.length, b.length) > 32) return 0;
  const allowedEdits = Math.min(a.length, b.length) >= 7 ? 2 : 1;
  if (Math.abs(a.length - b.length) > allowedEdits) return 0;
  const distance = editDistance(a, b);
  const similarity = 1 - distance / Math.max(a.length, b.length);
  return distance <= allowedEdits && similarity >= 0.75 ? similarity : 0;
}

function coverage(query: string[], candidate: string[]): number[] {
  const used = new Set<number>();
  const values = query.map(() => 0);
  // Reserve exact tokens first, so a fuzzy token cannot consume another word's exact match.
  query.forEach((word, index) => {
    const found = candidate.findIndex((other, position) => !used.has(position) && word === other);
    if (found !== -1) { used.add(found); values[index] = 1; }
  });
  query.forEach((word, index) => {
    if (values[index]) return;
    let best = 0; let position = -1;
    candidate.forEach((other, otherIndex) => {
      if (used.has(otherIndex)) return;
      const value = tokenSimilarity(word, other);
      if (value > best) { best = value; position = otherIndex; }
    });
    if (position !== -1) { used.add(position); values[index] = best; }
  });
  return values;
}

export function createNameMatcher(queryText: string): (candidateText: string) => NameMatch {
  const query = parseName(queryText);
  return candidateText => {
    // A seller mentioning another cultivar in a negated clause is not offering that cultivar.
    const candidate = parseName(candidateText).positive;
    const excluded = query.excluded.some(words => coverage(words, candidate).every(value => value > 0));
    if (excluded) return { kind: 'excluded', score: 0, matchedTokens: [], unmatchedTokens: query.positive,
      reason: 'Tên sản phẩm thuộc phần bạn yêu cầu loại trừ.' };
    if (!query.positive.length) return { kind: 'unspecified', score: 0, matchedTokens: [], unmatchedTokens: [],
      reason: 'Chưa có từ khóa tên sản phẩm.' };
    const values = coverage(query.positive, candidate);
    const matchedTokens = query.positive.filter((_, index) => values[index] > 0);
    const unmatchedTokens = query.positive.filter((_, index) => values[index] === 0);
    const kind = values.every(value => value === 1) ? 'exact'
      : !unmatchedTokens.length ? 'fuzzy' : matchedTokens.length ? 'partial' : 'none';
    const reason = kind === 'exact' ? 'Khớp đầy đủ từ khóa tên sản phẩm.'
      : kind === 'fuzzy' ? 'Tên gần khớp; có thể có lỗi gõ, cần kiểm tra lại giống.'
      : kind === 'partial' ? `Chỉ khớp một phần tên; chưa khớp: ${unmatchedTokens.join(', ')}.`
      : 'Chưa khớp từ khóa tên sản phẩm.';
    return { kind, score: values.reduce((sum, value) => sum + value, 0) / values.length,
      matchedTokens, unmatchedTokens, reason };
  };
}

export function matchProductName(query: string, candidate: string): NameMatch {
  return createNameMatcher(query)(candidate);
}

const tiers: Record<NameMatch['kind'], number> = { exact: 3, fuzzy: 2, partial: 1, none: 0, unspecified: 0, excluded: -1 };
export function compareNameMatches(a: NameMatch, b: NameMatch): number {
  return tiers[b.kind] - tiers[a.kind] || b.score - a.score;
}

export function productSearchText(record: { title: string; fruit_type_id: string; variety_id: string | null },
  catalog?: ProductCatalog): string {
  const type = catalog?.types.find(item => item.id === record.fruit_type_id)?.name;
  const variety = catalog?.varieties.find(item => item.id === record.variety_id)?.name;
  // Separate fields preserve generic fruit words ("Bơ") as well as compact codes ("Bơ 034").
  return [type, variety, type && variety ? `${type} ${variety}` : undefined, record.title]
    .filter(Boolean).join(', ');
}
