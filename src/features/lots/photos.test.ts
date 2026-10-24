import {beforeEach,expect,test,vi} from 'vitest';
const mocks=vi.hoisted(()=>({rows:[] as {lot_id:string;storage_path:string;is_ai_generated:boolean}[],sign:vi.fn(),where:vi.fn(),from:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{from:mocks.from,storage:{from:()=>({createSignedUrls:mocks.sign})}}}));
import {loadLotPhotos} from './api';
beforeEach(()=>{vi.clearAllMocks();mocks.rows=[];mocks.where.mockReturnValue({order:async()=>({data:mocks.rows,error:null})});mocks.from.mockReturnValue({select:()=>({in:mocks.where})});});
test('batch photos stay attached to their lot when signed URLs return out of order',async()=>{
 mocks.rows=[{lot_id:'a',storage_path:'a/one.jpg',is_ai_generated:true},{lot_id:'b',storage_path:'b/two.jpg',is_ai_generated:false}];
 mocks.sign.mockResolvedValue({data:[{path:'b/two.jpg',signedUrl:'https://example.test/b'},{path:'a/one.jpg',signedUrl:'https://example.test/a'}],error:null});
 expect(await loadLotPhotos(['a','b','a'])).toEqual({a:[{url:'https://example.test/a',is_ai_generated:true}],b:[{url:'https://example.test/b',is_ai_generated:false}]});
 expect(mocks.where).toHaveBeenCalledWith('lot_id',['a','b']);
});
test('no visible lots never fetches unrelated image metadata',async()=>{expect(await loadLotPhotos([])).toEqual({});expect(mocks.from).not.toHaveBeenCalled();});
test('a failed signed URL is reported instead of silently dropping a required image',async()=>{
 mocks.rows=[{lot_id:'a',storage_path:'a/one.jpg',is_ai_generated:false}];mocks.sign.mockResolvedValue({data:[{path:'a/one.jpg',signedUrl:null,error:'denied'}],error:null});
 await expect(loadLotPhotos(['a'])).rejects.toThrow('Chưa tải được ảnh');
});
