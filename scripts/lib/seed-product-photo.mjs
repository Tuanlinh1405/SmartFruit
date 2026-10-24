import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Backend-only seed helper. Never imported by the browser application.
export async function ensureSeedProductPhoto(admin,lotId){
 const [lot,images,types,varieties]=await Promise.all([
  admin.from('lots').select('id,farmer_id,fruit_type_id,variety_id').eq('id',lotId).single(),
  admin.from('lot_images').select('id').eq('lot_id',lotId).limit(1),
  admin.from('fruit_types').select('id,name'),admin.from('fruit_varieties').select('id,name')]);
 for(const r of[lot,images,types,varieties])if(r.error)throw r.error;
 if(images.data.length)return{created:false};
 const base=new URL('../../supabase/seed-assets/generated-products/',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('prompts.json',base),'utf8'));
 const fruit=types.data.find(x=>x.id===lot.data.fruit_type_id)?.name;
 const variety=varieties.data.find(x=>x.id===lot.data.variety_id)?.name;
 const asset=manifest.find(x=>x.fruit===fruit&&x.variety===variety);
 if(!asset)throw new Error(`No seed photo for ${fruit} / ${variety}; lot remains a draft`);
 const bytes=await readFile(new URL(asset.file,base));const hash=b=>createHash('sha256').update(b).digest('hex');
 const sha=hash(bytes);const path=`${lot.data.farmer_id}/${lotId}/ai-seed-20261024-${asset.key}-${sha.slice(0,10)}.jpg`;
 const bucket=admin.storage.from('lot-images');
 const upload=await bucket.upload(path,bytes,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});
 if(upload.error){
  if(!/already exists|duplicate/i.test(upload.error.message)&&String(upload.error.statusCode)!=='409')throw upload.error;
  const existing=await bucket.download(path);if(existing.error)throw existing.error;
  if(hash(Buffer.from(await existing.data.arrayBuffer()))!==sha)throw new Error('Existing seed image content mismatch');
 }
 const link=await admin.from('lot_images').insert({lot_id:lotId,storage_path:path,sort_order:0,is_ai_generated:true});
 if(link.error)throw link.error;
 return{created:true};
}
