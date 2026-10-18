import type { EmbeddingProvider } from './search-service.ts';
import { EMBEDDING_MODEL } from './embedding-config.ts';
import { validateEmbeddingResponse } from './embedding-http.ts';

export interface QueryVectorCache {
  get(hash: string): Promise<unknown>;
  put(hash: string,vector: number[]): Promise<void>;
}
export function cachedEmbeddingProvider(provider: EmbeddingProvider,cache: QueryVectorCache): EmbeddingProvider {
  const pending=new Map<string,Promise<number[]>>();
  return {async query(text) {
    const value=text.trim().slice(0,600);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${EMBEDDING_MODEL.version}:query:${value}`));
    const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
    let task=pending.get(hash);
    if (!task) {
      task=(async()=>{
        try {
          const saved=await cache.get(hash);
          const vector=typeof saved==='string'?JSON.parse(saved):saved;
          return validateEmbeddingResponse({modelVersion:EMBEDDING_MODEL.version,vector});
        } catch { /* Cache misses and outages must not fabricate semantic scores. */ }
        const vector=validateEmbeddingResponse({modelVersion:EMBEDDING_MODEL.version,vector:await provider.query(value)});
        try { await cache.put(hash,vector); } catch { /* The current valid result remains usable. */ }
        return vector;
      })();
      pending.set(hash,task);
      void task.finally(()=>pending.delete(hash)).catch(()=>{});
    }
    return task;
  }};
}
