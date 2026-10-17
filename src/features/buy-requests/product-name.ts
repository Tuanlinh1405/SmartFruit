import type { FruitType, FruitVariety } from '../../lib/domain';
import { normalizeSearchText } from '../matching/name-match';

export type RequestCatalog = { types: FruitType[]; varieties: FruitVariety[] };

function searchableName(value: string) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b([a-z]+)\s+(\d+)\b/g, '$1$2').trim();
}

// Resolve the existing required FK from the one visible name field. Keep cultivar
// wording in title for name reranking, rather than guessing a hard variety filter.
export function resolveRequestProductName(name: string, catalog: RequestCatalog) {
  const text = ` ${searchableName(name)} `;
  const contains = (label: string) => {
    const normalized = searchableName(label);
    return Boolean(normalized) && text.includes(` ${normalized} `);
  };
  const explicit = catalog.types.filter(type => type.active && contains(type.name));
  const ids = explicit.length ? explicit.map(type => type.id) : [...new Set(
    catalog.varieties.filter(variety => variety.active && contains(variety.name))
      .map(variety => variety.fruit_type_id),
  )].filter(id => catalog.types.some(type => type.id === id && type.active));
  if (ids.length !== 1) throw new Error(ids.length > 1
    ? 'Mỗi yêu cầu chỉ nhập tên một nông sản.'
    : 'Chưa nhận ra nông sản. Hãy nhập tên đầy đủ, ví dụ: Sầu riêng Ri6.');
  return { fruit_type_id: ids[0], variety_id: null };
}
