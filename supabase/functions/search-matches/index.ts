import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import type { BuyRequest, Lot } from '../../../src/lib/domain.ts';
import { EMBEDDING_MODEL } from '../../../src/features/matching/embedding-config.ts';
import { searchMatches, SearchAccessError, type CandidateRow,
  type EmbeddingProvider, type SearchRepository } from '../../../src/features/matching/search-service.ts';

const projectUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const modelUrl = Deno.env.get('EMBEDDING_SERVICE_URL');
const modelToken = Deno.env.get('EMBEDDING_SERVICE_TOKEN');
const origin = Deno.env.get('SEARCH_ALLOWED_ORIGIN') || '*';
const cors = { 'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const requestFields = 'id,buyer_id,fruit_type_id,variety_id,title,grade,target_quantity_kg,min_lot_quantity_kg,allow_partial,min_price_vnd_per_kg,max_price_vnd_per_kg,required_start,required_end,preferred_provinces,preferred_districts,quality_requirements,packaging_options,buying_method,transport_by,notes,status,created_at,updated_at';
const lotFields = 'id,farmer_id,fruit_type_id,variety_id,title,grade,quantity_kg,price_vnd_per_kg,harvest_start,harvest_end,province,district,certifications,packaging_options,selling_method,description,status,created_at';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Cần đăng nhập để tìm kiếm.' }, 401);
  let input: Record<string, unknown>;
  try { input = await request.json(); }
  catch { return json({ error: 'Nội dung yêu cầu không hợp lệ.' }, 400); }
  if ((input.direction !== 'buyer-to-lots' && input.direction !== 'farmer-to-requests') ||
    typeof input.sourceId !== 'string' || !uuidPattern.test(input.sourceId) ||
    typeof input.text !== 'string' || input.text.length > 200 ||
    !Number.isInteger(input.page) || Number(input.page) < 1 || Number(input.page) > 100 ||
    !Number.isInteger(input.pageSize) || Number(input.pageSize) < 1 || Number(input.pageSize) > 50) {
    return json({ error: 'Bộ lọc tìm kiếm không hợp lệ.' }, 400);
  }

  const supabase = createClient(projectUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !identity.user) return json({ error: 'Phiên đăng nhập đã hết hạn.' }, 401);

  const check = <T>(data: T, error: { message: string } | null): T => {
    if (error) throw new Error(error.message);
    return data;
  };
  const mapCandidates = (rows: Record<string, unknown>[] | null, direction: 'lot' | 'request'): CandidateRow[] =>
    (rows ?? []).map(row => ({
      id: String(row[direction === 'lot' ? 'lot_id' : 'request_id']),
      cosineSimilarity: row.cosine_similarity == null ? undefined : Number(row.cosine_similarity),
      graphPaths: Array.isArray(row.graph_paths) ? row.graph_paths.map(String) : [],
      eligibleCount: Number(row.eligible_count || 0), truncated: Boolean(row.truncated),
    }));
  const repository: SearchRepository = {
    async catalog() {
      const [types, varieties] = await Promise.all([
        supabase.from('fruit_types').select('id,name').eq('active', true),
        supabase.from('fruit_varieties').select('id,name').eq('active', true),
      ]);
      return { types: check(types.data, types.error) ?? [], varieties: check(varieties.data, varieties.error) ?? [] };
    },
    async getBuyerRequest(id, userId) {
      const result = await supabase.from('buy_requests').select(requestFields)
        .eq('id', id).eq('buyer_id', userId).in('status', ['OPEN', 'DRAFT']).maybeSingle();
      return check(result.data, result.error) as BuyRequest | null;
    },
    async getFarmerLot(id, userId) {
      const result = await supabase.from('lots').select(lotFields)
        .eq('id', id).eq('farmer_id', userId).eq('status', 'PUBLISHED').maybeSingle();
      return check(result.data, result.error) as Lot | null;
    },
    async lotCandidates(id, embedding, text) {
      const result = embedding ? await supabase.rpc('search_lot_vector_top20', {
        source_request_id: id, query_embedding: `[${embedding.join(',')}]`,
        active_model_version: EMBEDDING_MODEL.version,
      }) : await supabase.rpc('search_lot_candidates', {
        source_request_id: id, query_embedding: null, query_text: text,
      });
      return mapCandidates(check(result.data, result.error), 'lot');
    },
    async requestCandidates(id, embedding, text) {
      const result = embedding ? await supabase.rpc('search_request_vector_top20', {
        source_lot_id: id, query_embedding: `[${embedding.join(',')}]`,
        active_model_version: EMBEDDING_MODEL.version,
      }) : await supabase.rpc('search_request_candidates', {
        source_lot_id: id, query_embedding: null, query_text: text,
      });
      return mapCandidates(check(result.data, result.error), 'request');
    },
    async lots(ids) {
      if (!ids.length) return [];
      const result = await supabase.from('lots').select(lotFields).in('id', ids).eq('status', 'PUBLISHED');
      return check(result.data, result.error) as Lot[];
    },
    async requests(ids) {
      if (!ids.length) return [];
      const result = await supabase.from('buy_requests').select(requestFields).in('id', ids).eq('status', 'OPEN');
      return check(result.data, result.error) as BuyRequest[];
    },
  };
  const embeddingProvider: EmbeddingProvider | undefined = modelUrl && modelToken ? {
    async query(text) {
      const response = await fetch(`${modelUrl.replace(/\/$/, '')}/embed`, {
        method: 'POST', signal: AbortSignal.timeout(3000),
        headers: { Authorization: `Bearer ${modelToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 600), kind: 'query',
          modelVersion: EMBEDDING_MODEL.version }),
      });
      if (!response.ok) throw new Error(`Embedding HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.modelVersion !== EMBEDDING_MODEL.version || !Array.isArray(payload.vector)) {
        throw new Error('Invalid embedding model or response');
      }
      return payload.vector as number[];
    },
  } : undefined;
  try {
    return json(await searchMatches({
      direction: input.direction as 'buyer-to-lots' | 'farmer-to-requests',
      sourceId: input.sourceId as string, text: input.text as string,
      page: Number(input.page), pageSize: Number(input.pageSize),
    }, identity.user.id, repository, embeddingProvider));
  } catch (error) {
    if (error instanceof SearchAccessError) return json({ error: error.message }, 403);
    console.error('search-matches failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'Tìm kiếm tạm thời không khả dụng. Hãy thử chế độ theo quy tắc.' }, 503);
  }
});
