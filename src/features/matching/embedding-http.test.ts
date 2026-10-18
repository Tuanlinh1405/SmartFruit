// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { httpEmbeddingProvider } from './embedding-http';
import { EMBEDDING_MODEL } from './embedding-config';

const token = 'test-only-token-with-32-characters-0000';
const vector = [1, ...Array(767).fill(0)];
describe('private embedding HTTP contract', () => {
  it('sends the pinned query contract only to the server with a bounded timeout', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({modelVersion: EMBEDDING_MODEL.version, vector}));
    expect(await httpEmbeddingProvider('https://encoder.example/', token, 10000, request).query('Ri6')).toEqual(vector);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe('https://encoder.example/embed');
    expect(init?.headers).toMatchObject({Authorization:`Bearer ${token}`});
    expect(JSON.parse(init!.body as string)).toEqual({text:'Ri6',kind:'query',modelVersion:EMBEDDING_MODEL.version});
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
  it('rejects wrong models, zero, non-numeric and wrong-sized vectors', async () => {
    for (const payload of [
      {modelVersion:'other',vector}, {modelVersion:EMBEDDING_MODEL.version,vector:[1]},
      {modelVersion:EMBEDDING_MODEL.version,vector:Array(768).fill(0)},
      {modelVersion:EMBEDDING_MODEL.version,vector:Array(768).fill('0.1')},
    ]) {
      const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload));
      await expect(httpEmbeddingProvider('https://encoder.example', token, 10000, request).query('Ri6')).rejects.toThrow('Invalid embedding response');
    }
  });
  it('surfaces status without copying provider response details', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('private error', {status:429}));
    await expect(httpEmbeddingProvider('https://encoder.example',token,10000,request).query('Ri6')).rejects.toThrow(/^Embedding HTTP 429$/);
  });
  it('rejects insecure service URLs and invalid configuration before transmitting secrets', () => {
    for (const url of ['http://encoder.example','https://user:password@encoder.example','https://encoder.example?key=secret','ftp://encoder.example']) {
      expect(()=>httpEmbeddingProvider(url,token)).toThrow();
    }
    expect(()=>httpEmbeddingProvider('https://encoder.example','short')).toThrow();
    expect(()=>httpEmbeddingProvider('https://encoder.example',token,0)).toThrow();
    expect(()=>httpEmbeddingProvider('http://127.0.0.1:8080',token)).not.toThrow();
  });
});
