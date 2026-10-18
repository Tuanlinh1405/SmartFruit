// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {gradioEmbeddingProvider, gradioBatchEncoder, gradioResult} from './embedding-gradio';

const token='test-token-for-gradio-32-characters-000';
const output={modelVersion:'multilingual-e5-base-v1',vectors:[[1,...Array(767).fill(0)]]};
it('retrieves a Gradio job and validates its E5 vector without putting a secret in URLs',async()=>{
  const request=vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({event_id:'1234567890abcdef1234567890abcdef'}))
    .mockResolvedValueOnce(new Response(`event: heartbeat\ndata: null\n\nevent: complete\ndata: ${JSON.stringify([output])}\n\n`));
  expect(await gradioEmbeddingProvider('https://example.hf.space',token,60000,request).query('Sầu riêng Ri6')).toEqual(output.vectors[0]);
  expect(request.mock.calls).toHaveLength(2);
  expect(JSON.parse(request.mock.calls[0][1]!.body as string).data[1]).toBe(token);
  expect(request.mock.calls.every(([url])=>!String(url).includes(token))).toBe(true);
  expect(request.mock.calls[0][1]?.signal).toBe(request.mock.calls[1][1]?.signal);
});
it('parses fragmented CRLF events',async()=>{
  const raw=`event: complete\r\ndata: ${JSON.stringify([output])}\r\n\r\n`;
  const stream=new ReadableStream({start(controller){for(const piece of raw)controller.enqueue(new TextEncoder().encode(piece));controller.close();}});
  expect(await gradioResult(new Response(stream))).toEqual(output);
});
it('fails on quota errors, premature stream end and malformed results',async()=>{
  for(const raw of ['event: error\ndata: "private-details"\n\n','event: heartbeat\ndata: null\n\n','event: complete\ndata: []\n\n']) {
    await expect(gradioResult(new Response(raw))).rejects.toThrow();
  }
});
it('rejects malformed event IDs before issuing a result request',async()=>{
  const request=vi.fn<typeof fetch>().mockResolvedValue(Response.json({event_id:'../../secret'}));
  await expect(gradioEmbeddingProvider('https://example.hf.space',token,60000,request).query('Ri6')).rejects.toThrow('Invalid Gradio event');
  expect(request).toHaveBeenCalledTimes(1);
});
it('supports long passage batches and rejects truncated batch responses',async()=>{
  const request=vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({event_id:'1234567890abcdef1234567890abcdef'}))
    .mockResolvedValueOnce(new Response(`event: complete\ndata: ${JSON.stringify([output])}\n\n`));
  await expect(gradioBatchEncoder('https://example.hf.space',token,60000,request)(['x'.repeat(5000),'Mít'],'passage')).rejects.toThrow('Invalid embedding batch result');
  expect(JSON.parse(request.mock.calls[0][1]!.body as string).data[0].texts[0]).toHaveLength(5000);
});
