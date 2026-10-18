// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {cachedEmbeddingProvider} from './embedding-cache';
const vector=[1,...Array(767).fill(0)];
it('shares in-flight inference and reads persistent cached vectors without new GPU work',async()=>{
  const saved=new Map<string,number[]>();
  const provider={query:vi.fn(async()=>vector)};
  const cache={get:vi.fn(async(hash:string)=>saved.get(hash)),put:vi.fn(async(hash:string,v:number[])=>{saved.set(hash,v);})};
  const wrapped=cachedEmbeddingProvider(provider,cache);
  expect(await Promise.all([wrapped.query('Ri6'),wrapped.query('Ri6')])).toEqual([vector,vector]);
  expect(provider.query).toHaveBeenCalledTimes(1);
  expect(await cachedEmbeddingProvider(provider,cache).query('Ri6')).toEqual(vector);
  expect(provider.query).toHaveBeenCalledTimes(1);
  expect([...saved.keys()][0]).toMatch(/^[a-f0-9]{64}$/);
});
it('treats corrupt cache as a miss and never stores failed inference',async()=>{
  const cache={get:async()=>JSON.stringify(Array(768).fill(0)),put:vi.fn()};
  const wrapped=cachedEmbeddingProvider({query:async()=>{throw Error('quota');}},cache);
  await expect(wrapped.query('Ri6')).rejects.toThrow('quota');
  await expect(wrapped.query('Ri6')).rejects.toThrow('quota');
  expect(cache.put).not.toHaveBeenCalled();
});
