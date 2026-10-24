import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
process.loadEnvFile('.env.admin.local');
const url=process.env.SUPABASE_URL;
assert.equal(url,'https://yyslykqpamnlqkvutrlm.supabase.co','Unexpected project');
const client=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const assetRoot=new URL('../supabase/seed-assets/generated-products/',import.meta.url);
const actualRoot=process.env.LOT_PHOTO_ASSET_ROOT?new URL(process.env.LOT_PHOTO_ASSET_ROOT):assetRoot;
const manifest=JSON.parse(await readFile(new URL('prompts.json',actualRoot),'utf8'));
const [lots,photos,types,varieties,origin]=await Promise.all([
 client.from('lots').select('id,farmer_id,fruit_type_id,variety_id,status').order('id'),
 client.from('lot_images').select('id,lot_id,storage_path,sort_order'),
 client.from('fruit_types').select('id,name'),client.from('fruit_varieties').select('id,name'),
 client.from('lot_images').select('is_ai_generated').limit(0)]);
for(const r of[lots,photos,types,varieties])if(r.error)throw r.error;
if(origin.error&&!['42703','PGRST204'].includes(origin.error.code))throw origin.error;
const plans=[];
for(const lot of lots.data){
 const fruit=types.data.find(x=>x.id===lot.fruit_type_id)?.name;
 const variety=varieties.data.find(x=>x.id===lot.variety_id)?.name;
 const asset=manifest.find(a=>a.fruit===fruit&&a.variety===variety);
 assert.ok(asset,`No generated asset for ${fruit} / ${variety}`);
 const bytes=await readFile(new URL(asset.file,actualRoot));
 const sha=createHash('sha256').update(bytes).digest('hex');
 const path=`${lot.farmer_id}/${lot.id}/ai-seed-20261024-${asset.key}-${sha.slice(0,10)}.jpg`;
 plans.push({lot,asset,bytes,path,missing:!photos.data.some(p=>p.lot_id===lot.id)});
}
const apply=process.argv.includes('--apply');
console.log(JSON.stringify({mode:apply?'apply':'dry-run',lots:plans.length,missing:plans.filter(p=>p.missing).length,assets:manifest.length,provenanceReady:!origin.error}));
if(!apply)process.exit(0);
const report={created:[],preserved:[],markedAi:[],orphans:[]};
for(const p of plans){
 const current=await client.from('lot_images').select('id,storage_path').eq('lot_id',p.lot.id);if(current.error)throw current.error;
 if(!current.data.length){
  const upload=await client.storage.from('lot-images').upload(p.path,p.bytes,{contentType:'image/jpeg',upsert:false,cacheControl:'3600'});
  if(upload.error&&!['409','Duplicate'].includes(String(upload.error.statusCode??upload.error.error))&&!/already exists/i.test(upload.error.message))throw upload.error;
  const inserted=await client.from('lot_images').insert({lot_id:p.lot.id,storage_path:p.path,sort_order:0,...(!origin.error?{is_ai_generated:true}:{})}).select('id').single();
  if(inserted.error){
   const after=await client.from('lot_images').select('id,storage_path').eq('lot_id',p.lot.id);if(after.error)throw after.error;
   if(!after.data.some(x=>x.storage_path===p.path)){report.orphans.push(p.path);await writeFile('tmp/lot-image-seed-report.json',JSON.stringify(report,null,2));throw new Error('Image link failed; existing user photos preserved, no objects deleted');}
  }
  report.created.push({lotId:p.lot.id,asset:p.asset.key,path:p.path});
 }else report.preserved.push(p.lot.id);
 if(!origin.error){
  const marked=await client.from('lot_images').update({is_ai_generated:true}).eq('lot_id',p.lot.id).eq('storage_path',p.path).select('id');
  if(marked.error)throw marked.error;if(marked.data.length)report.markedAi.push(p.lot.id);
 }
}
const final=await client.from('lot_images').select('lot_id');if(final.error)throw final.error;
report.totalImages=final.data.length;report.missingLots=plans.filter(p=>!final.data.some(i=>i.lot_id===p.lot.id)).map(p=>p.lot.id);
await writeFile('tmp/lot-image-seed-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({created:report.created.length,preserved:report.preserved.length,markedAi:report.markedAi.length,totalImages:report.totalImages,missingLots:report.missingLots.length,deleted:0}));
assert.equal(report.missingLots.length,0);
