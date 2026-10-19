import { supabase } from '../../lib/supabase';
import type { FruitType, FruitVariety } from '../../lib/domain';

export async function loadCatalog(): Promise<{ types: FruitType[]; varieties: FruitVariety[] }> {
  const [typesResult, varietiesResult] = await Promise.all([
    supabase.from('fruit_types').select('id,code,name,active').eq('active', true).order('name'),
    supabase.from('fruit_varieties').select('id,fruit_type_id,code,name,active').eq('active', true).order('name'),
  ]);
  if (typesResult.error) throw typesResult.error;
  if (varietiesResult.error) throw varietiesResult.error;
  return { types: typesResult.data as FruitType[], varieties: varietiesResult.data as FruitVariety[] };
}
