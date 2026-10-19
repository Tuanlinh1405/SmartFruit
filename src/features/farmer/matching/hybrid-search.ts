import type { SupabaseClient } from '@supabase/supabase-js';
import type { FarmerMatchResponse } from '../../matching/api';
import type { Lot } from '../lots/lot.model';
import type { BuyCandidate, MatchResult } from './farmer-matching';

export interface FarmerSearchResult {
  lot: Lot;
  requests: BuyCandidate[];
  partners: { user_id: string; display_name: string; province: string | null }[];
  matches: MatchResult[];
  mode: 'hybrid' | 'degraded';
}

// The server owns retrieval and reranking. Never add local candidates to top 20.
export async function searchFarmerCandidates(client: SupabaseClient, lot: Lot): Promise<FarmerSearchResult> {
  const { data, error } = await client.functions.invoke('search-matches', {
    body: { direction: 'farmer-to-requests', sourceId: lot.id, text: '', page: 1, pageSize: 20 },
  });
  if (error) throw error;
  const response = data as FarmerMatchResponse;
  if (!response || !Array.isArray(response.items) || !['hybrid', 'degraded'].includes(response.meta?.mode)
    || (response.meta.mode === 'hybrid' && (response.meta.rankingScope !== 'vector_top20' || response.items.length > 20))) {
    throw new Error('Phản hồi matching không hợp lệ.');
  }
  const requests = response.items.map(item => item.request);
  const buyerIds = [...new Set(requests.map(request => request.buyer_id))];
  const partners: FarmerSearchResult['partners'] = [];
  for (let i = 0; i < buyerIds.length; i += 100) {
    const result = await client.from('marketplace_profiles').select('user_id,display_name,province').in('user_id', buyerIds.slice(i, i + 100));
    if (result.error || !result.data) throw new Error('Không thể tải thông tin đối tác.');
    partners.push(...result.data);
  }
  return { lot, requests, partners, mode: response.meta.mode, matches: response.items.map(item => ({
    lotId: lot.id, requestId: item.request.id, score: item.score,
    reasons: [item.nameMatch.reason, ...item.business.reasons], missingInformation: [],
    ruleVersion: item.ruleVersion, suggestedQuantityKg: item.business.contributionKg,
    cosineSimilarity: item.cosineSimilarity,
  })) };
}
