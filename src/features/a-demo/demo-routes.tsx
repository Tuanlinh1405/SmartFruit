import type { ReactNode } from 'react';
import { CarrierRequests, CarrierTracking, DemoDashboard, DemoReviews, FarmerChat, FarmerMap, FarmerNotifications, FarmerPrices, FarmerTransport, FarmerWeather } from './demo-pages';
export const aDemoRoutes: Record<string, ReactNode> = {
  'FUI-01': <DemoDashboard role="FARMER" />, 'FUI-06': <FarmerTransport />, 'FUI-07': <FarmerChat />, 'FUI-09': <DemoReviews role="FARMER" />,
  'FUI-10': <FarmerPrices />, 'FUI-11': <FarmerWeather />, 'FUI-12': <FarmerMap />, 'FUI-13': <FarmerNotifications />,
  'CUI-01': <DemoDashboard role="CARRIER" />, 'CUI-03': <CarrierRequests />, 'CUI-05': <CarrierTracking />, 'CUI-06': <DemoReviews role="CARRIER" />,
};
