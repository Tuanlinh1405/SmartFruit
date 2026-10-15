import { supabase } from '../../lib/supabase';
import type { BuyRequest, RequestInput, RequestStatus } from '../../lib/domain';

const fields = 'id,buyer_id,fruit_type_id,variety_id,title,grade,target_quantity_kg,min_lot_quantity_kg,allow_partial,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end,preferred_provinces,preferred_districts,quality_requirements,packaging_options,buying_method,transport_by,notes,status,created_at,updated_at';

export async function listMyRequests(buyerId: string): Promise<BuyRequest[]> {
  const { data, error } = await supabase.from('buy_requests').select(fields).eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as BuyRequest[];
}

export async function getMyRequest(id: string, buyerId: string): Promise<BuyRequest | null> {
  const { data, error } = await supabase.from('buy_requests').select(fields)
    .eq('id', id).eq('buyer_id', buyerId).maybeSingle();
  if (error) throw error;
  return data as unknown as BuyRequest | null;
}

export async function createRequest(id: string, buyerId: string, input: RequestInput): Promise<BuyRequest> {
  // A stable ID lets a retry detect a successful insert after a network timeout.
  const existing = await getMyRequest(id, buyerId);
  if (existing) return existing;
  const { data, error } = await supabase.from('buy_requests')
    .insert({ id, buyer_id: buyerId, ...input }).select(fields).single();
  if (error) {
    if (error.code === '23505') {
      const retried = await getMyRequest(id, buyerId);
      if (retried) return retried;
    }
    throw error;
  }
  return data as unknown as BuyRequest;
}

export async function updateRequest(id: string, buyerId: string, input: RequestInput): Promise<BuyRequest> {
  const { data, error } = await supabase.from('buy_requests').update(input)
    .eq('id', id).eq('buyer_id', buyerId).select(fields).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Nhu cầu không còn tồn tại hoặc bạn không có quyền sửa.');
  return data as unknown as BuyRequest;
}

export async function changeRequestStatus(id: string, buyerId: string, from: RequestStatus, to: RequestStatus) {
  const allowed: Record<RequestStatus, RequestStatus[]> = {
    DRAFT: ['OPEN', 'CANCELLED'], OPEN: ['CLOSED', 'CANCELLED'], CLOSED: [], CANCELLED: [],
  };
  if (!allowed[from].includes(to)) throw new Error('Không thể chuyển trạng thái nhu cầu theo cách này.');
  const { data, error } = await supabase.from('buy_requests').update({ status: to })
    .eq('id', id).eq('buyer_id', buyerId).eq('status', from).select(fields).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Trạng thái đã thay đổi hoặc bạn không có quyền sửa. Hãy tải lại danh sách.');
  return data as unknown as BuyRequest;
}
