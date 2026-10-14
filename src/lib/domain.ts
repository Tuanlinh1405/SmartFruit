export type AppRole = 'FARMER' | 'BUYER' | 'CARRIER' | 'ADMIN';
export type LotStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
export type RequestStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
export type TradeMethod = 'WHOLE_FARM' | 'BY_GRADE' | 'PARTIAL' | 'OFFTAKE';
export type TransportBy = 'BUYER' | 'FARMER' | 'UNDECIDED';

export interface Profile {
  id: string;
  role: AppRole | null;
  full_name: string;
  phone_display: string | null;
}

export interface BuyerProfile {
  user_id: string;
  organization_name: string;
  province: string;
  address: string | null;
}

export interface FruitType { id: string; code: string; name: string; active: boolean }
export interface FruitVariety { id: string; fruit_type_id: string; code: string; name: string; active: boolean }

export interface BuyRequest {
  id: string;
  buyer_id: string;
  fruit_type_id: string;
  variety_id: string | null;
  title: string;
  grade: string | null;
  target_quantity_kg: number;
  min_lot_quantity_kg: number | null;
  allow_partial: boolean;
  min_price_vnd_per_kg: number;
  max_price_vnd_per_kg: number;
  required_start: string;
  required_end: string;
  preferred_provinces: string[];
  preferred_districts: string[];
  quality_requirements: string[];
  packaging_options: string[];
  buying_method: TradeMethod;
  transport_by: TransportBy;
  notes: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

export interface Lot {
  id: string;
  farmer_id: string;
  fruit_type_id: string;
  variety_id: string | null;
  title: string;
  grade: string | null;
  quantity_kg: number;
  price_vnd_per_kg: number;
  harvest_start: string;
  harvest_end: string;
  province: string;
  district: string | null;
  certifications: string[];
  packaging_options: string[];
  selling_method: TradeMethod;
  description: string;
  status: LotStatus;
  created_at: string;
}

export interface MarketplaceProfile {
  user_id: string;
  display_name: string;
  province: string;
  role: AppRole;
}

export type RequestInput = Omit<BuyRequest, 'id' | 'buyer_id' | 'created_at' | 'updated_at'>;

export const tradeLabels: Record<TradeMethod, string> = {
  WHOLE_FARM: 'Mua xô cả vườn',
  BY_GRADE: 'Mua theo loại',
  PARTIAL: 'Gom lẻ',
  OFFTAKE: 'Hợp đồng bao tiêu',
};

export const transportLabels: Record<TransportBy, string> = {
  BUYER: 'Thương lái tự điều xe',
  FARMER: 'Nhà vườn giao',
  UNDECIDED: 'Xem xét sau',
};

export const statusLabels: Record<RequestStatus | LotStatus, string> = {
  DRAFT: 'Bản nháp', OPEN: 'Đang mở', PUBLISHED: 'Đang bán',
  CLOSED: 'Đã đóng', CANCELLED: 'Đã hủy',
};
