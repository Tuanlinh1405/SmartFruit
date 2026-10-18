import { EMBEDDING_MODEL } from './embedding-config.ts';
import { validateEmbeddingEndpoint, validateEmbeddingResponse } from './embedding-http.ts';
import type { EmbeddingProvider } from './search-service.ts';

// Gradio uses a POST job followed by an SSE result stream. Tokens stay server-side.
export async function gradioResult(response: Response): Promise<unknown> {
  if (!response.ok || !response.body) throw new Error(`Gradio HTTP ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', bytes = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) throw new Error('Gradio stream ended without a result');
      bytes += value.byteLength;
      if (bytes > 1_000_000) throw new Error('Gradio result too large');
      buffer += decoder.decode(value, {stream:true});
      let separator: RegExpMatchArray | null;
      while ((separator = buffer.match(/\r?\n\r?\n/))) {
        const block = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index! + separator[0].length);
        const lines = block.split(/\r?\n/);
        const event = lines.find(line=>line.startsWith('event:'))?.slice(6).trim();
        if (event === 'error') throw new Error('Gradio inference failed or quota exhausted');
        if (event === 'complete') {
          const data = JSON.parse(lines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n'));
          if (!Array.isArray(data) || data.length !== 1) throw new Error('Invalid Gradio output');
          return data[0];
        }
      }
    }
  } finally { await reader.cancel().catch(()=>{}); }
}

export function gradioEmbeddingProvider(url: string, token: string,
  timeoutMs = 60_000, request: typeof fetch = fetch): EmbeddingProvider {
  const encode = gradioBatchEncoder(url, token, timeoutMs, request);
  return {async query(text) { return (await encode([text.slice(0,600)], 'query'))[0]; }};
}

export function gradioBatchEncoder(url: string, token: string,
  timeoutMs = 60_000, request: typeof fetch = fetch) {
  validateEmbeddingEndpoint(url, token, timeoutMs);
  const endpoint = `${url.replace(/\/$/, '')}/gradio_api/call/embed`;
  return async (texts: string[], kind: 'query' | 'passage'): Promise<number[][]> => {
    if (!texts.length || texts.length>16 || (kind==='query' && texts.length!==1) ||
      texts.some(text=>!text.trim() || text.length>(kind==='query'?600:8000))) throw new Error('Invalid embedding batch');
    const signal = AbortSignal.timeout(timeoutMs);
    const job = await request(endpoint, {
      method:'POST', signal, redirect:'error', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({data:[{texts,kind,modelVersion:EMBEDDING_MODEL.version},token]}),
    });
    if (!job.ok) throw new Error(`Gradio HTTP ${job.status}`);
    const {event_id: eventId} = await job.json();
    if (typeof eventId !== 'string' || !/^[a-zA-Z0-9_-]{16,64}$/.test(eventId)) throw new Error('Invalid Gradio event');
    const result = await gradioResult(await request(`${endpoint}/${eventId}`, {signal,redirect:'error'})) as {modelVersion?:unknown;vectors?:unknown};
    if (!Array.isArray(result?.vectors) || result.vectors.length!==texts.length) throw new Error('Invalid embedding batch result');
    return result.vectors.map(vector=>validateEmbeddingResponse({modelVersion:result?.modelVersion,vector}));
  };
}
