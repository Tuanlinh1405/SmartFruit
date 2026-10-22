import { supabase } from '../../lib/supabase';

export const vehicleTypes = { TARPAULIN:'Xe mui bạt', ENCLOSED:'Xe thùng kín', REFRIGERATED:'Xe lạnh' };
export type VehicleType = keyof typeof vehicleTypes;
export interface TransportSource {lot_id:string;agreement_id:string|null;title:string;quantity_kg:number;province:string;available_start:string;available_end:string}
export interface VehicleMatch {id:string;carrier_id:string;vehicle_type:VehicleType;capacity_kg:number;provinces:string[];company_name:string;min_temperature_c:number|null;max_temperature_c:number|null}
export interface Shipment {target_lot_id:string;target_agreement_id:string|null;kg:number;origin:string;destination:string;origin_detail:string;destination_detail:string;pickup:string;required:VehicleType;temp_min:number|null;temp_max:number|null}
export interface TransportRequest {id:string;requester_id:string;carrier_id:string;source_title:string;carrier_name:string;vehicle_label:string;quantity_kg:number;origin_province:string;destination_province:string;origin_address:string;destination_address:string;pickup_date:string;status:'PENDING'|'QUOTED'|'ACCEPTED'|'DECLINED'|'CANCELLED';quote_vnd:number|null;quote_note:string;created_at:string}
export const transportLabels:Record<TransportRequest['status'],string>={PENDING:'Chờ nhà xe phản hồi',QUOTED:'Đã báo giá',ACCEPTED:'Đã thống nhất',DECLINED:'Nhà xe từ chối',CANCELLED:'Đã hủy'};
export async function transportRpc<T>(name:string,args:Record<string,unknown>={}):Promise<T>{const r=await supabase.rpc(name,args);if(r.error)throw r.error;return r.data as T;}
export const loadTransportSources=()=>transportRpc<TransportSource[]>('my_transport_sources');
export const findVehicles=(s:Shipment,page:number)=>transportRpc<{items:VehicleMatch[];count:number}>('find_transport_vehicles',{kg:s.kg,origin:s.origin,destination:s.destination,required:s.required,temp_min:s.temp_min,temp_max:s.temp_max,page_number:page});
export const createTransport=(s:Shipment,id:string)=>transportRpc<string>('create_transport_request',{...s,target_vehicle_id:id});
export const respondTransport=(id:string,decision:string,price:number|null=null,note='')=>transportRpc<void>('respond_transport_request',{target_id:id,decision,price,note});
export async function listTransport(page=1){const r=await supabase.from('transport_requests').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range((page-1)*20,page*20-1);if(r.error)throw r.error;return{items:r.data as TransportRequest[],count:r.count??0};}
