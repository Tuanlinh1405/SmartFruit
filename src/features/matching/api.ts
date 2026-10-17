import { supabase } from '../../lib/supabase';
import type { MatchResult, RequestMatchResult } from './core';

export interface MatchResponse {
  items: MatchResult[];
  meta: {
    mode: 'hybrid' | 'degraded';
    ruleVersion: string;
    modelVersion: string | null;
    rankingScope: 'all_eligible' | 'candidate_pool' | 'vector_top20';
    truncated: boolean;
    candidateCount: number;
    eligibleCount: number;
    resultCount: number;
    page: number;
    pageSize: number;
    generatedAt: string;
  };
}

export type FarmerMatchResponse = Omit<MatchResponse, 'items'> & { items: RequestMatchResult[] };

export async function searchBuyerMatches(sourceId: string, text: string, page: number,
  pageSize = 12): Promise<MatchResponse> {
  const { data, error } = await supabase.functions.invoke('search-matches', {
    body: { direction: 'buyer-to-lots', sourceId, text, page, pageSize },
  });
  if (error) throw error;
  if (!data || !Array.isArray(data.items) || !data.meta) throw new Error('Phản hồi tìm kiếm không hợp lệ.');
  return data as MatchResponse;
}

export async function searchFarmerMatches(sourceId: string): Promise<FarmerMatchResponse> {
  const { data, error } = await supabase.functions.invoke('search-matches', {
    body: { direction: 'farmer-to-requests', sourceId, text: '', page: 1, pageSize: 20 },
  });
  if (error) throw error;
  if (!data || !Array.isArray(data.items) || !data.meta) throw new Error('Phản hồi tìm kiếm không hợp lệ.');
  return data as FarmerMatchResponse;
}
