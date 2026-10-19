export const demoPartners = [
  { id: 'buyer-demo-1', name: 'Vựa An Phú', province: 'Tiền Giang', fruit: 'Sầu riêng', quantity: 50000, price: 65000 },
  { id: 'buyer-demo-2', name: 'Thu mua Miền Tây', province: 'Long An', fruit: 'Mít', quantity: 12000, price: 18000 },
];
export const demoVehicles = [
  { id: 'vehicle-demo-1', name: 'Xe thùng kín 5 tấn', capacity: 5000, type: 'ENCLOSED' },
  { id: 'vehicle-demo-2', name: 'Xe lạnh 10 tấn', capacity: 10000, type: 'REFRIGERATED' },
];
export interface DemoTransport { id: string; origin: string; destination: string; kg: number; when: string; vehicleType: string; packaging: string; offer: number; vehicleId?: string; quote?: number; status: 'NEW' | 'QUOTED' | 'ACCEPTED'; }
export interface DemoMessage { id: string; partnerId: string; text: string; mine: boolean; }
export interface DemoReview { id: string; author: string; role: 'FARMER' | 'CARRIER'; stars: number; text: string; sent: boolean; }
export interface ADemoState { transports: DemoTransport[]; messages: DemoMessage[]; reviews: DemoReview[]; readNotifications: string[]; confirmations: string[]; }
export function initialDemoState(): ADemoState {
  return {
    transports: [{ id: 'transport-demo-1', origin: 'Cai Lậy, Tiền Giang', destination: 'Chợ đầu mối, TP.HCM', kg: 5000, when: '2026-10-20T08:00', vehicleType: 'ENCLOSED', packaging: 'Thùng carton', offer: 2500000, status: 'NEW' }],
    messages: [{ id: 'message-demo-1', partnerId: 'buyer-demo-1', text: 'Tôi quan tâm lô Ri6, xin trao đổi lịch thu hoạch.', mine: false }],
    reviews: [{ id: 'review-demo-1', author: 'Vựa An Phú', role: 'FARMER', stars: 5, text: 'Thông tin lô rõ ràng.', sent: false }, { id: 'review-demo-2', author: 'Nhà vườn Bình An', role: 'CARRIER', stars: 4, text: 'Xe đến đúng hẹn.', sent: false }],
    readNotifications: [], confirmations: [],
  };
}
