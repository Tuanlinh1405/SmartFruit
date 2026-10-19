export const lotStatuses = ['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED'] as const;
export type LotStatus = typeof lotStatuses[number];
export const tradeMethods = { WHOLE_FARM: 'Bán cả vườn', BY_GRADE: 'Theo phân loại', PARTIAL: 'Bán lẻ từng phần', OFFTAKE: 'Bao tiêu' } as const;
export interface LotInput {
  title: string; fruit_type_id: string; variety_id: string | null; grade: string | null;
  quantity_kg: number; price_vnd_per_kg: number; harvest_start: string; harvest_end: string;
  province: string; district: string | null; growing_area_code: string | null;
  certifications: string[]; packaging_options: string[];
  selling_method: keyof typeof tradeMethods; description: string;
}
export interface Lot extends LotInput { id: string; farmer_id: string; status: LotStatus; created_at: string; updated_at: string; }
export interface LotPrivateInput { price_floor_vnd_per_kg: number | null; internal_notes: string; }
export interface FruitType { id: string; name: string; active: boolean; }
export interface FruitVariety extends FruitType { fruit_type_id: string; }
export interface LotCatalog { fruits: FruitType[]; varieties: FruitVariety[]; }
export interface LotListFilters {
  search: string; status: LotStatus | ''; fruitTypeId: string; province: string;
  sort: 'newest' | 'price_asc' | 'price_desc'; page: number;
}
export const initialLotFilters: LotListFilters = { search: '', status: '', fruitTypeId: '', province: '', sort: 'newest', page: 1 };
export const lotPageSize = 20;
export interface LotsRepository {
  hasFarmerProfile(userId: string): Promise<boolean>;
  catalog(userId: string): Promise<LotCatalog>;
  list(userId: string, filters: LotListFilters): Promise<{ rows: Lot[]; count: number }>;
  detail(userId: string, id: string): Promise<Lot>;
  createDraft(userId: string, input: LotInput, draftId: string): Promise<Lot>;
  update(userId: string, id: string, input: LotInput): Promise<Lot>;
  changeStatus(userId: string, id: string, status: LotStatus): Promise<Lot>;
  remove(userId: string, id: string): Promise<void>;
}
export interface LotPrivateRepository {
  load(userId: string, id: string): Promise<LotPrivateInput | null>;
  save(userId: string, id: string, input: LotPrivateInput): Promise<LotPrivateInput>;
}
export type LotFormValues = { [K in Exclude<keyof LotInput, 'quantity_kg'>]: string } & { quantity: string; unit: 'kg' | 'tonne' };
export type LotErrors = Partial<Record<keyof LotFormValues, string>>;

// Parse in thousandths of kg using BigInt. Never round a form quantity.
export function parseQuantity(text: string, unit: 'kg' | 'tonne'): number | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) return null;
  const places = unit === 'kg' ? 3 : 6;
  const fraction = (match[2] ?? '').replace(/0+$/, '');
  if (fraction.length > places) return null;
  const milliKg = BigInt(match[1]) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'));
  if (milliKg <= 0n || milliKg > 99999999999999n) return null;
  return Number(milliKg) / 1000;
}
export function formatQuantity(kg: number, unit: 'kg' | 'tonne'): string {
  // DB numeric(14,3) values fit safely in integer thousandths.
  const milliKg = BigInt(Math.round(kg * 1000));
  const places = unit === 'kg' ? 3 : 6;
  const scale = 10n ** BigInt(places);
  const fraction = (milliKg % scale).toString().padStart(places, '0').replace(/0+$/, '');
  return `${milliKg / scale}${fraction ? `.${fraction}` : ''}`;
}
export function parsePrice(text: string): number | null {
  const value = text.trim();
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function lotToForm(lot?: LotInput | null): LotFormValues {
  return {
    title: lot?.title ?? '', fruit_type_id: lot?.fruit_type_id ?? '', variety_id: lot?.variety_id ?? '',
    grade: lot?.grade ?? '', quantity: lot ? formatQuantity(lot.quantity_kg, 'tonne') : '', unit: 'tonne',
    price_vnd_per_kg: lot ? String(lot.price_vnd_per_kg) : '', harvest_start: lot?.harvest_start ?? '', harvest_end: lot?.harvest_end ?? '',
    province: lot?.province ?? '', district: lot?.district ?? '', growing_area_code: lot?.growing_area_code ?? '',
    certifications: lot?.certifications.join('\n') ?? '', packaging_options: lot?.packaging_options.join('\n') ?? '',
    selling_method: lot?.selling_method ?? 'PARTIAL', description: lot?.description ?? '',
  };
}
export function parseLotForm(values: LotFormValues): { data: LotInput; errors?: never } | { errors: LotErrors; data?: never } {
  const errors: LotErrors = {};
  for (const [field, max, required] of [
    ['title', 200, true], ['province', 120, true], ['district', 120, false], ['grade', 80, false],
    ['growing_area_code', 100, false], ['description', 5000, false],
  ] as const) {
    const text = values[field].trim();
    if (required && !text) errors[field] = 'Vui lòng nhập thông tin này.';
    else if (Array.from(text).length > max) errors[field] = `Tối đa ${max} ký tự.`;
  }
  if (!values.fruit_type_id) errors.fruit_type_id = 'Vui lòng chọn loại quả.';
  const quantity = parseQuantity(values.quantity, values.unit);
  if (quantity === null) errors.quantity = 'Nhập khối lượng dương hợp lệ; độ chính xác tối thiểu 0,001 kg và dưới 100 tỷ kg.';
  const price = parsePrice(values.price_vnd_per_kg);
  if (price === null) errors.price_vnd_per_kg = 'Nhập giá nguyên dương trong giới hạn số nguyên an toàn.';
  for (const key of ['harvest_start', 'harvest_end'] as const) {
    if (!isCalendarDate(values[key])) errors[key] = 'Vui lòng nhập ngày hợp lệ.';
  }
  if (!errors.harvest_start && !errors.harvest_end && values.harvest_start > values.harvest_end) errors.harvest_end = 'Ngày kết thúc không được trước ngày bắt đầu.';
  if (!Object.hasOwn(tradeMethods, values.selling_method)) errors.selling_method = 'Phương thức bán không hợp lệ.';
  const lists = { certifications: [] as string[], packaging_options: [] as string[] };
  for (const key of ['certifications', 'packaging_options'] as const) {
    lists[key] = values[key].split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    if (lists[key].length > 32 || lists[key].some(item => Array.from(item).length > 120)) errors[key] = 'Tối đa 32 mục, mỗi mục tối đa 120 ký tự.';
  }
  if (Object.keys(errors).length) return { errors };
  return { data: {
    title: values.title.trim(), fruit_type_id: values.fruit_type_id, variety_id: values.variety_id || null,
    grade: values.grade.trim() || null, quantity_kg: quantity!, price_vnd_per_kg: price!,
    harvest_start: values.harvest_start, harvest_end: values.harvest_end,
    province: values.province.trim(), district: values.district.trim() || null, growing_area_code: values.growing_area_code.trim() || null,
    ...lists, selling_method: values.selling_method as LotInput['selling_method'], description: values.description.trim(),
  } };
}
export function catalogErrors(input: LotInput, catalog: LotCatalog, previous?: LotInput): LotErrors {
  const errors: LotErrors = {};
  const fruit = catalog.fruits.find(item => item.id === input.fruit_type_id);
  if (!fruit || (!fruit.active && previous?.fruit_type_id !== fruit.id)) errors.fruit_type_id = 'Loại quả không còn khả dụng.';
  if (input.variety_id) {
    const variety = catalog.varieties.find(item => item.id === input.variety_id);
    if (!variety || variety.fruit_type_id !== input.fruit_type_id || (!variety.active && previous?.variety_id !== variety.id)) errors.variety_id = 'Giống phải thuộc loại quả và còn khả dụng.';
  }
  return errors;
}
export function privateInput(floor: string, notes: string, askingPrice: number): LotPrivateInput {
  const price = floor.trim() ? parsePrice(floor) : null;
  if ((floor.trim() && price === null) || (price !== null && price > askingPrice)) throw new Error('Giá sàn phải là số nguyên dương và không vượt giá chào.');
  if (Array.from(notes).length > 5000) throw new Error('Ghi chú nội bộ tối đa 5000 ký tự.');
  return { price_floor_vnd_per_kg: price, internal_notes: notes };
}
export function canChangeStatus(from: LotStatus, to: LotStatus): boolean {
  return (from === 'DRAFT' && ['PUBLISHED', 'CLOSED', 'CANCELLED'].includes(to)) || (from === 'PUBLISHED' && ['CLOSED', 'CANCELLED'].includes(to));
}
