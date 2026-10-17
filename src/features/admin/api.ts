import { supabase } from '../../lib/supabase';
import type { AppRole } from '../../lib/domain';
export interface Member { id: string; role: AppRole | null; full_name: string; display_name: string;
  province: string; is_suspended: boolean; created_at: string }
export interface AdminListing { id: string; kind: 'lot' | 'request'; title: string; owner_id: string;
  owner_name: string; quantity_kg: number; province: string; status: string; created_at: string }
export interface AdminConnection { id: string; buyer_name: string; farmer_name: string; lot_title: string;
  status: string; agreement_status: string | null; created_at: string }
async function call<T>(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await supabase.rpc(name, args); if (error) throw error; return data as T;
}
export const getDirectory = () => call<Member[]>('admin_directory');
export const getMarketplace = () => call<AdminListing[]>('admin_marketplace');
export const getConnections = () => call<AdminConnection[]>('admin_trade_overview');
export const updateMember = (member: Member) => call('admin_update_member', {
  target_id: member.id, member_name: member.full_name, business_name: member.display_name,
  member_province: member.province, suspended: member.is_suspended,
});
export const closeListing = (listing: AdminListing) => call('admin_close_listing', { target_id: listing.id, target_kind: listing.kind });
