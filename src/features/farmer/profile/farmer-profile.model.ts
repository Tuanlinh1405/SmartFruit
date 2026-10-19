// Domain DTOs follow the applied farmer_profiles migration; not generated DB types.
export interface FarmerProfileInput {
  farm_name: string;
  province: string;
  district: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  area_m2: number | null;
  tree_count: number | null;
  orchard_age_years: number | null;
  annual_yield_kg: number | null;
  cultivated_varieties: string[];
  certifications: string[];
  growing_area_code: string | null;
}

export interface FarmerProfile extends FarmerProfileInput { user_id: string; }
export type FarmerProfileFormValues = { [K in keyof FarmerProfileInput]: string };
export type FarmerProfileErrors = Partial<Record<keyof FarmerProfileInput, string>>;
export interface FarmerProfileRepository {
  load(userId: string): Promise<FarmerProfile | null>;
  save(userId: string, input: FarmerProfileInput): Promise<FarmerProfile>;
}

export const profileTextFields = [
  { name: 'farm_name', label: 'Tên vườn', maxLength: 160, required: true },
  { name: 'province', label: 'Tỉnh / thành phố', maxLength: 120, required: true },
  { name: 'district', label: 'Quận / huyện', maxLength: 120, required: false },
  { name: 'address', label: 'Địa chỉ', maxLength: 500, required: false },
  { name: 'growing_area_code', label: 'Mã vùng trồng', maxLength: 100, required: false },
] as const;

export const profileNumberFields = [
  { name: 'area_m2', label: 'Diện tích vườn', unit: 'm²', min: 0, exclusiveMin: true, max: 999999999999.99, decimals: 2 },
  { name: 'tree_count', label: 'Số cây', unit: 'cây', min: 0, exclusiveMin: false, max: 2147483647, decimals: 0 },
  { name: 'orchard_age_years', label: 'Tuổi vườn', unit: 'năm', min: 0, exclusiveMin: false, max: 9999.9, decimals: 1 },
  { name: 'annual_yield_kg', label: 'Sản lượng hằng năm', unit: 'kg', min: 0, exclusiveMin: false, max: 99999999999.999, decimals: 3 },
  { name: 'latitude', label: 'Vĩ độ', unit: 'độ', min: -90, exclusiveMin: false, max: 90, decimals: 6 },
  { name: 'longitude', label: 'Kinh độ', unit: 'độ', min: -180, exclusiveMin: false, max: 180, decimals: 6 },
] as const;

export function profileToForm(profile?: FarmerProfileInput | null): FarmerProfileFormValues {
  return {
    farm_name: profile?.farm_name ?? '', province: profile?.province ?? '',
    district: profile?.district ?? '', address: profile?.address ?? '',
    growing_area_code: profile?.growing_area_code ?? '',
    area_m2: profile?.area_m2 == null ? '' : String(profile.area_m2),
    tree_count: profile?.tree_count == null ? '' : String(profile.tree_count),
    orchard_age_years: profile?.orchard_age_years == null ? '' : String(profile.orchard_age_years),
    annual_yield_kg: profile?.annual_yield_kg == null ? '' : String(profile.annual_yield_kg),
    latitude: profile?.latitude == null ? '' : String(profile.latitude),
    longitude: profile?.longitude == null ? '' : String(profile.longitude),
    cultivated_varieties: profile?.cultivated_varieties.join('\n') ?? '',
    certifications: profile?.certifications.join('\n') ?? '',
  };
}

export function parseProfileForm(values: FarmerProfileFormValues):
  { data: FarmerProfileInput; errors?: never } | { data?: never; errors: FarmerProfileErrors } {
  const errors: FarmerProfileErrors = {};
  const data: FarmerProfileInput = {
    farm_name: values.farm_name.trim(), province: values.province.trim(),
    district: values.district.trim() || null, address: values.address.trim() || null,
    growing_area_code: values.growing_area_code.trim() || null,
    area_m2: null, tree_count: null, orchard_age_years: null, annual_yield_kg: null,
    latitude: null, longitude: null, cultivated_varieties: [], certifications: [],
  };
  for (const field of profileTextFields) {
    const text = values[field.name].trim();
    if (field.required && !text) errors[field.name] = 'Vui lòng nhập thông tin này.';
    else if (Array.from(text).length > field.maxLength) errors[field.name] = `Tối đa ${field.maxLength} ký tự.`;
  }
  for (const field of profileNumberFields) {
    const text = values[field.name].trim();
    if (!text) continue;
    const number = Number(text);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(number)) {
      errors[field.name] = 'Vui lòng nhập số hữu hạn hợp lệ.';
    } else if (number < field.min || (field.exclusiveMin && number === field.min) || number > field.max) {
      errors[field.name] = `Giá trị phải ${field.exclusiveMin ? 'lớn hơn' : 'từ'} ${field.min} và không vượt ${field.max}.`;
    } else if ((text.split('.')[1]?.length ?? 0) > field.decimals) {
      errors[field.name] = field.decimals === 0 ? 'Vui lòng nhập số nguyên.' : `Tối đa ${field.decimals} chữ số thập phân.`;
    } else data[field.name] = number;
  }
  if (!!values.latitude.trim() !== !!values.longitude.trim()) {
    const missing = values.latitude.trim() ? 'longitude' : 'latitude';
    errors[missing] = 'Vui lòng nhập đủ vĩ độ và kinh độ hoặc để trống cả hai.';
  }
  for (const name of ['cultivated_varieties', 'certifications'] as const) {
    data[name] = values[name].split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    if (data[name].length > 32 || data[name].some(item => Array.from(item).length > 120)) {
      errors[name] = 'Tối đa 32 mục; mỗi mục tối đa 120 ký tự.';
    }
  }
  return Object.keys(errors).length ? { errors } : { data };
}
