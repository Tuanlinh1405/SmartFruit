import { formatQuantity, parseQuantity } from '../../farmer/lots/lot.model';
export const vehicleTypes = { TARPAULIN: 'Thùng bạt', ENCLOSED: 'Thùng kín', REFRIGERATED: 'Xe lạnh' } as const;
export interface CarrierProfileInput { company_name: string; province: string; address: string | null; service_provinces: string[]; }
export interface VehicleInput { license_plate: string; vehicle_type: keyof typeof vehicleTypes; capacity_kg: number; provinces: string[]; min_temperature_c: number | null; max_temperature_c: number | null; active: boolean; }
export interface Vehicle extends VehicleInput { id: string; carrier_id: string; }
export interface VehicleFilters { search: string; province: string; active: '' | 'true' | 'false'; sort: 'newest' | 'capacity'; page: number; }
export const initialVehicleFilters: VehicleFilters = { search: '', province: '', active: '', sort: 'newest', page: 1 };
export interface CarrierRepository {
  profile(userId: string): Promise<CarrierProfileInput | null>;
  saveProfile(userId: string, input: CarrierProfileInput): Promise<CarrierProfileInput>;
  list(userId: string, filters: VehicleFilters): Promise<{ rows: Vehicle[]; count: number }>;
  saveVehicle(userId: string, input: VehicleInput, id?: string): Promise<Vehicle>;
  remove(userId: string, id: string): Promise<void>;
}
export function labels(text: string): string[] {
  const values = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (values.length > 32 || values.some(x => Array.from(x).length > 120)) throw new Error('Tối đa 32 mục; mỗi mục tối đa 120 ký tự.');
  return values;
}
function text(value: string, max: number, required = false): string {
  const result = value.trim(); if ((required && !result) || Array.from(result).length > max) throw new Error(`Thông tin bắt buộc hoặc vượt giới hạn ${max} ký tự.`); return result;
}
export function carrierProfile(input: CarrierProfileInput): CarrierProfileInput {
  return { company_name: text(input.company_name, 160, true), province: text(input.province, 120, true), address: text(input.address ?? '', 500) || null, service_provinces: labels(input.service_provinces.join('\n')) };
}
export function normalizePlate(plate: string): string { return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); }
export function validateVehicle(input: VehicleInput): VehicleInput {
  const plate = text(input.license_plate, 24, true);
  if (plate.length < 3 || !normalizePlate(plate)) throw new Error('Biển số phải có từ 3 đến 24 ký tự và có chữ/số.');
  if (!Object.hasOwn(vehicleTypes, input.vehicle_type)) throw new Error('Loại xe không hợp lệ.');
  if (!Number.isFinite(input.capacity_kg) || parseQuantity(String(input.capacity_kg), 'kg') !== input.capacity_kg) throw new Error('Tải trọng phải dương, tối đa ba chữ số thập phân kg và dưới 100 tỷ kg.');
  const min = input.min_temperature_c; const max = input.max_temperature_c;
  if ((min === null) !== (max === null)) throw new Error('Nhập đủ hai đầu nhiệt độ hoặc bỏ trống cả hai.');
  if (min !== null && max !== null) {
    if (input.vehicle_type !== 'REFRIGERATED') throw new Error('Chỉ xe lạnh được đặt nhiệt độ.');
    if ([min, max].some(x => !Number.isFinite(x) || x < -100 || x > 100 || !/^-?\d+(\.\d{1,2})?$/.test(String(x))) || min > max) throw new Error('Nhiệt độ −100…100°C, tối đa hai chữ số thập phân; min không vượt max.');
  }
  return { license_plate: plate, vehicle_type: input.vehicle_type, capacity_kg: input.capacity_kg, provinces: labels(input.provinces.join('\n')), min_temperature_c: min, max_temperature_c: max, active: input.active === true };
}
export { parseQuantity, formatQuantity };
