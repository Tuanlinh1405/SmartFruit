// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {processEmbeddingBatch} from './embedding-worker';
const vector=[1,...Array(767).fill(0)];
const jobs=[{job_id:1,attempts:1,canonical_text:'Sầu riêng Ri6'},{job_id:2,attempts:2,canonical_text:'Mít Thái'}];
it('encodes passages in one batch and preserves database stale/lease decisions',async()=>{
  const finish=vi.fn().mockResolvedValueOnce('DONE').mockResolvedValueOnce('STALE');
  const encode=vi.fn().mockResolvedValue([vector,vector.map(x=>x*2)]);
  expect(await processEmbeddingBatch({claim:async()=>jobs,finish},encode)).toEqual({claimed:2,outcomes:{DONE:1,STALE:1}});
  expect(encode).toHaveBeenCalledWith(jobs.map(x=>x.canonical_text),'passage');
  expect(finish.mock.calls[1][1]).toEqual(vector);
});
it('retries the entire batch when any vector is invalid; no partial or fake embeddings',async()=>{
  for(const output of [[vector],[vector,Array(768).fill(0)],[vector,[NaN,...Array(767).fill(0)]]]) {
    const finish=vi.fn().mockResolvedValue('PENDING');
    expect((await processEmbeddingBatch({claim:async()=>jobs,finish},async()=>output)).outcomes).toEqual({PENDING:2});
    expect(finish.mock.calls.every(call=>call[1]===null)).toBe(true);
  }
});
it('does not spend GPU time for an empty queue; rejects unbounded batches',async()=>{
  const encode=vi.fn();const queue={claim:async()=>[],finish:vi.fn()};
  expect(await processEmbeddingBatch(queue,encode)).toEqual({claimed:0,outcomes:{}});
  expect(encode).not.toHaveBeenCalled();
  await expect(processEmbeddingBatch(queue,encode,17)).rejects.toThrow();
});
