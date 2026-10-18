import { EMBEDDING_MODEL } from './embedding-config.ts';
import type { EmbeddingProvider } from './search-service.ts';

export function httpEmbeddingProvider(url: string, token: string,
  timeoutMs = 10_000, request: typeof fetch = fetch): EmbeddingProvider {
  validateEmbeddingEndpoint(url, token, timeoutMs);
  return { async query(text) {
    const response = await request(`${url.replace(/\/$/, '')}/embed`, {
      method: 'POST', signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 600), kind: 'query', modelVersion: EMBEDDING_MODEL.version }),
    });
    if (!response.ok) throw new Error(`Embedding HTTP ${response.status}`);
    return validateEmbeddingResponse(await response.json());
  } };
}

export function validateEmbeddingEndpoint(url: string, token: string, timeoutMs: number) {
  const base = new URL(url);
  if (base.username || base.password || base.search || base.hash ||
      (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname)))) {
    throw new Error('Embedding URL must use HTTPS without credentials or query parameters');
  }
  if (token.length < 32 || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60_000) {
    throw new Error('Invalid embedding service configuration');
  }
}

export function validateEmbeddingResponse(payload: {modelVersion?: unknown; vector?: unknown}): number[] {
    if (payload.modelVersion !== EMBEDDING_MODEL.version || !Array.isArray(payload.vector) ||
        payload.vector.length !== EMBEDDING_MODEL.dimensions ||
        payload.vector.some((value: unknown) => typeof value !== 'number' || !Number.isFinite(value)) ||
        !payload.vector.some((value: number) => value !== 0)) {
      throw new Error('Invalid embedding response');
    }
    return payload.vector as number[];
}
