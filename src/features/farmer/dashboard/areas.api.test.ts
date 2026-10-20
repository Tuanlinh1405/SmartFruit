import {beforeEach,expect,test,vi} from 'vitest';
const mocks=vi.hoisted(()=>({from:vi.fn()}));vi.mock('../../../lib/supabase',()=>({supabase:{from:mocks.from}}));
import {loadAreaRequests} from './areas';
beforeEach(()=>vi.clearAllMocks());
function database(count:number,error:unknown=null){
  const queries:Record<string,ReturnType<typeof vi.fn>>[]=[];
  mocks.from.mockImplementation(()=>{let offset=0;const q:Record<string,ReturnType<typeof vi.fn>>={};
    for(const name of ['select','eq','gte','order'])q[name]=vi.fn(()=>q);
    q.range=vi.fn((start:number)=>{offset=start;return q;});
    q.abortSignal=vi.fn(async()=>({error,count,data:error?null:Array.from({length:Math.max(0,Math.min(100,count-offset))},(_,i)=>({id:String(offset+i)}))}));queries.push(q);return q;
  });return queries;
}
test('dashboard requests only public columns, OPEN/unexpired records, and stable paginated IDs',async()=>{
  const queries=database(205);const signal=new AbortController().signal;const result=await loadAreaRequests(signal);
  expect(result.requests).toHaveLength(205);expect(result.truncated).toBe(false);expect(queries).toHaveLength(3);
  expect(queries[0].eq).toHaveBeenCalledWith('status','OPEN');expect(queries[0].gte).toHaveBeenCalledWith('required_end',expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));expect(queries[0].order).toHaveBeenCalledWith('id');expect(queries[2].range).toHaveBeenCalledWith(200,299);expect(queries[0].abortSignal).toHaveBeenCalledWith(signal);
  const projection=queries[0].select.mock.calls[0][0] as string;expect(projection).not.toContain('*');expect(projection).not.toContain('price_floor');expect(projection).not.toContain('buyer_id');
});
test('more than 1000 rows is explicitly truncated and never fetched beyond the cap',async()=>{
  const queries=database(1200);const result=await loadAreaRequests();expect(result.requests).toHaveLength(1000);expect(result.truncated).toBe(true);expect(queries).toHaveLength(10);expect(queries[9].range).toHaveBeenCalledWith(900,999);
});
test('server denial never becomes a successful empty map',async()=>{
  database(0,{code:'42501'});await expect(loadAreaRequests()).rejects.toThrow('Không tải được khu vực thu mua');
});
