import { EMBEDDING_MODEL } from './embedding-config.ts';
import { validateEmbeddingResponse } from './embedding-http.ts';

export interface EmbeddingJob { job_id: number; attempts: number; canonical_text: string }
export interface EmbeddingQueue {
  claim(limit: number): Promise<EmbeddingJob[]>;
  finish(job: EmbeddingJob, vector: number[] | null): Promise<string>;
}
export type BatchEncoder = (texts: string[], kind: 'passage') => Promise<number[][]>;

export async function processEmbeddingBatch(queue: EmbeddingQueue, encode: BatchEncoder, limit=16) {
  if (!Number.isInteger(limit) || limit<1 || limit>16) throw new Error('Invalid batch size');
  const jobs = await queue.claim(limit);
  if (!jobs.length) return {claimed:0,outcomes:{} as Record<string,number>};
  let vectors: number[][] | null = null;
  try {
    const encoded = await encode(jobs.map(job=>job.canonical_text.slice(0,8000)), 'passage');
    if (encoded.length!==jobs.length) throw new Error('Invalid batch result');
    // Validate the entire batch before committing any result.
    vectors = encoded.map(vector=>{
      validateEmbeddingResponse({modelVersion:EMBEDDING_MODEL.version,vector});
      const norm=Math.hypot(...vector);
      if (!Number.isFinite(norm) || norm===0) throw new Error('Invalid vector norm');
      return vector.map(value=>value/norm);
    });
  } catch { /* The database applies bounded retry/backoff; never persist a fake vector. */ }
  const outcomes: Record<string,number> = {};
  for (const [index,job] of jobs.entries()) {
    const status=await queue.finish(job,vectors?.[index] ?? null);
    outcomes[status]=(outcomes[status] ?? 0)+1;
  }
  return {claimed:jobs.length,outcomes};
}
