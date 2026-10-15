import type { LucideIcon } from 'lucide-react';

export type Role = 'FARMER' | 'BUYER' | 'CARRIER' | 'ADMIN';
export type FeatureLevel = 'F' | 'D' | 'U';
export type DisplayStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED' | 'OPEN' | 'NEGOTIATING' | 'CONFIRMED_DEMO' | 'DELIVERED_DEMO';
export interface UiEntry {
  id: string;
  title: string;
  path: string;
  kind: 'page' | 'modal';
  role?: Role;
  owner: 'A' | 'B';
  level: FeatureLevel;
  icon?: LucideIcon;
}
