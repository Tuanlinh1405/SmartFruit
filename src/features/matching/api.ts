import { supabase } from '../../lib/supabase';
import type { MatchResult } from './core';

export interface MatchResponse {
  items: MatchResult[];
  meta: {
    mode: 'hybrid' | 'degraded';
    ruleVersion: string;
    modelVersion: string | null;
    rankingScope: 'all_eligible' | 'candidate_pool';
    truncated: boolean;
    candidateCount: number;
    resultCount: number;
    page: number;
    pageSize: number;
    generatedAt: string;
  };
}

export async function searchBuyerMatches(sourceId: string, text: string, page: number,
  pageSize = 12): Promise<MatchResponse> {
  const { data, error } = await supabase.functions.invoke('search-matches', {
    body: { direction: 'buyer-to-lots', sourceId, text, page, pageSize },
  });
  if (error) throw error;
  if (!data || !Array.isArray(data.items) || !data.meta) throw new Error('Phản hồi tìm kiếm không hợp lệ.');
  return data as MatchResponse;
}
