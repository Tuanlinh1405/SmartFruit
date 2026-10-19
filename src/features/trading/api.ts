import { supabase } from '../../lib/supabase';
import { loadFarmerCards } from '../lots/api';

export interface Connection {
  id: string; lot_id: string; lot_title: string; buy_request_id: string | null;
  buyer_id: string; farmer_id: string; initiated_by: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  created_at: string; updated_at: string; partnerName?: string;
}
export interface Message { id: string; connection_id: string; sender_id: string; body: string; created_at: string }
export interface Offer {
  id: string; connection_id: string; proposed_by: string; price_vnd_per_kg: number;
  quantity_kg: number; delivery_date: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'SUPERSEDED'; created_at: string;
}
export interface Agreement {
  id: string; connection_id: string; offer_id: string; price_vnd_per_kg: number;
  quantity_kg: number; delivery_date: string; buyer_completed_at: string | null;
  farmer_completed_at: string | null; status: 'AGREED' | 'COMPLETED';
}
export interface Review { id: string; agreement_id: string; reviewer_id: string; target_id: string;
  rating: number; comment: string; created_at: string }

export async function listConnections(userId: string): Promise<Connection[]> {
  const { data, error } = await supabase.from('trade_connections').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  const rows = data as Connection[];
  const names = await loadFarmerCards(rows.map(row => row.buyer_id === userId ? row.farmer_id : row.buyer_id));
  return rows.map(row => ({ ...row, partnerName: names[row.buyer_id === userId ? row.farmer_id : row.buyer_id]?.display_name || 'Đối tác' }));
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args); if (error) throw error; return data as T;
}
export const openConnection = (lotId: string, requestId?: string) => rpc<string>('open_trade_connection', {
  target_lot_id: lotId, target_request_id: requestId || null,
});
export const respondConnection = (id: string, decision: string) => rpc('respond_trade_connection', { target_id: id, decision });
export const sendMessage = (id: string, messageId: string, body: string) => rpc('send_trade_message', {
  target_connection_id: id, message_id: messageId, message_body: body,
});
export const proposeOffer = (id: string, price: number, quantity: number, delivery: string) => rpc('propose_trade_offer', {
  target_connection_id: id, price, quantity, delivery,
});
export const respondOffer = (id: string, decision: string) => rpc('respond_trade_offer', { target_id: id, decision });
export const completeAgreement = (id: string) => rpc('complete_trade_agreement', { target_id: id });
export const submitReview = (id: string, stars: number, comment: string) => rpc('submit_trade_review', {
  target_agreement_id: id, stars, review_comment: comment,
});
export async function loadThread(id: string) {
  const [messages, offers, agreement] = await Promise.all([
    supabase.from('trade_messages').select('*').eq('connection_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100),
    supabase.from('trade_offers').select('*').eq('connection_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('trade_agreements').select('*').eq('connection_id', id).maybeSingle(),
  ]);
  for (const result of [messages, offers, agreement]) if (result.error) throw result.error;
  return { messages: (messages.data as Message[]).reverse(), offers: offers.data as Offer[], agreement: agreement.data as Agreement | null };
}
export async function loadReviews() {
  const [reviews, agreements] = await Promise.all([
    supabase.from('trade_reviews').select('*').order('created_at', { ascending: false }),
    supabase.from('trade_agreements').select('*').eq('status', 'COMPLETED'),
  ]);
  if (reviews.error) throw reviews.error; if (agreements.error) throw agreements.error;
  return { reviews: reviews.data as Review[], agreements: agreements.data as Agreement[] };
}
