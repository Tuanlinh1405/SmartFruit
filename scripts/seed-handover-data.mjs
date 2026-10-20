// Customer presentation data. Dry-run by default; no migrations or existing-data resets.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {rankMatches,rankRequestMatches,scoreBusiness} from '../src/features/matching/core.ts';

const apply=process.argv.includes('--apply');
const createAccounts=process.argv.includes('--create-accounts');
const cloudMatching=process.argv.includes('--check-matching');
const credentialsPath='tmp/handover-accounts.json';
const manifestPath='tmp/handover-data-manifest.json';
const expectedUrl='https://yyslykqpamnlqkvutrlm.supabase.co';
const definitions=[
 {name:'farmer3',role:'FARMER',fullName:'Nguyễn Hữu Phước',table:'farmer_profiles',profile:{farm_name:'Nhà vườn Phước An',province:'Đồng Nai',district:'Long Khánh',address:'Khu vực vườn Long Khánh, Đồng Nai',area_m2:140000,tree_count:1200,orchard_age_years:8,annual_yield_kg:100000,cultivated_varieties:['Ri6','Mít Thái','Thanh long ruột đỏ'],certifications:[]}},
 {name:'buyer3',role:'BUYER',fullName:'Trần Minh An',table:'buyer_profiles',profile:{organization_name:'Thu mua An Phú',province:'Hồ Chí Minh',address:'Kho tập kết khu vực Thủ Đức, Hồ Chí Minh'}},
 {name:'carrier3',role:'CARRIER',fullName:'Lê Quốc Thành',table:'carrier_profiles',profile:{company_name:'Vận tải Tân Phát',province:'Đồng Nai',address:'Bãi xe khu vực Long Thành, Đồng Nai',service_provinces:['Đồng Nai','Hồ Chí Minh','Tây Ninh']}},
];
const products=[
 {key:'ri6',fruit:'durian',variety:'ri6',title:'Sầu riêng Ri6 loại A',kg:5000,price:65000,min:62000,max:72000,packaging:'CARTON',description:'Vườn đang vào đợt thu hoạch, trái đồng đều 2–4 kg, tuyển loại A tại vườn. Có thể chia lịch cắt theo tiến độ nhận hàng và kiểm tra chất lượng trước khi bốc xe.',vehicleType:'REFRIGERATED',capacity:5000,plate:'60C-486.28'},
 {key:'mit-thai',fruit:'jackfruit',variety:'thai',title:'Mít Thái loại A',kg:8000,price:15000,min:14000,max:18000,packaging:'BULK',description:'Mít Thái tuyển trái đồng đều, dự kiến thu gom trong hai buổi. Nhà vườn hỗ trợ phân loại, cân tại điểm tập kết và bố trí nhân công bốc hàng theo giờ đã thống nhất.',vehicleType:'ENCLOSED',capacity:8000,plate:'60H-217.65'},
 {key:'thanh-long',fruit:'dragon_fruit',variety:'red_flesh',title:'Thanh long ruột đỏ loại A',kg:3000,price:22000,min:20000,max:26000,packaging:'CRATE',description:'Thanh long ruột đỏ tuyển loại A, khoảng 350–550 g/trái. Thu hoạch buổi sáng, phân loại và đóng sọt tại điểm tập kết trước khi giao kho theo lịch hẹn.',vehicleType:'TARPAULIN',capacity:3500,plate:'60C-392.74'},
];
await mkdir('tmp',{recursive:true});
const readJson=async path=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
let manifest=await readJson(manifestPath);
if(!manifest){
 const anchor=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 manifest={version:1,project:expectedUrl,anchor,users:{},ids:Object.fromEntries(products.map(p=>[p.key,{lot:randomUUID(),request:randomUUID(),vehicle:randomUUID()}]))};
}
assert.equal(manifest.project,expectedUrl);
const date=offset=>new Date(Date.parse(manifest.anchor+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
function rows(p,index,catalog=null,users={farmer3:'farmer3',buyer3:'buyer3',carrier3:'carrier3'}){
 const type=catalog?.types.find(t=>t.code===p.fruit);
 const variety=catalog?.varieties.find(v=>v.code===p.variety&&v.fruit_type_id===type?.id);
 if(catalog)assert.ok(type?.active&&variety?.active,`Active catalog required: ${p.key}`);
 const ids=manifest.ids[p.key];const start=date(1+index*2),end=date(31);
 const common={fruit_type_id:type?.id??p.fruit,variety_id:variety?.id??p.variety,title:p.title,grade:'A',packaging_options:[p.packaging]};
 return {
  lot:{...common,id:ids.lot,farmer_id:users.farmer3,quantity_kg:p.kg,price_vnd_per_kg:p.price,harvest_start:start,harvest_end:end,province:'Đồng Nai',district:'Long Khánh',selling_method:'PARTIAL',certifications:[],description:p.description,status:'PUBLISHED'},
  request:{...common,id:ids.request,buyer_id:users.buyer3,target_quantity_kg:p.kg,min_lot_quantity_kg:1000,allow_partial:true,min_price_vnd_per_kg:p.min,max_price_vnd_per_kg:p.max,required_start:start,required_end:end,preferred_provinces:['Đồng Nai'],preferred_districts:[],quality_requirements:['Phân loại tại vườn','Cân và kiểm tra chất lượng trước khi giao'],buying_method:'PARTIAL',transport_by:'BUYER',notes:'Nhận hàng tại kho An Phú, khu vực Thủ Đức. Thống nhất lịch lấy hàng trước một ngày; kiểm tra, cân hàng và xác nhận số lượng khi bàn giao.',status:'OPEN'},
  vehicle:{id:ids.vehicle,carrier_id:users.carrier3,license_plate:p.plate,vehicle_type:p.vehicleType,capacity_kg:p.capacity,provinces:['Đồng Nai','Hồ Chí Minh','Tây Ninh'],active:true},
 };
}
const proposed=products.map((p,i)=>rows(p,i));
for(const pair of proposed){
 const fit=scoreBusiness(pair.lot,pair.request);assert.ok(fit.eligible);assert.equal(fit.priceFit,1);assert.equal(fit.quantityFit,1);assert.ok(pair.vehicle.capacity_kg>=pair.lot.quantity_kg);
 const buyer=rankMatches(proposed.map(r=>({lot:r.lot})),pair.request,'rule-only');
 const farmer=rankRequestMatches(proposed.map(r=>({request:r.request})),pair.lot,'rule-only');
 assert.equal(buyer[0]?.lot.id,pair.lot.id);assert.equal(farmer[0]?.request.id,pair.request.id);
 assert.equal(buyer[0]?.score,100);assert.equal(farmer[0]?.score,100);
}
if(!apply){
 console.log(JSON.stringify({mode:'DRY_RUN',writes:false,accounts:definitions.map(d=>({email:d.name+'@logstar.test',role:d.role,business:d.profile.farm_name??d.profile.organization_name??d.profile.company_name})),products:proposed.map(r=>({title:r.lot.title,quantityKg:r.lot.quantity_kg,askingPrice:r.lot.price_vnd_per_kg,buyerRange:[r.request.min_price_vnd_per_kg,r.request.max_price_vnd_per_kg],start:r.lot.harvest_start,end:r.lot.harvest_end,vehicleCapacityKg:r.vehicle.capacity_kg})),carrierTrips:'Not supported by current schema; vehicles only'},null,2));
 process.exit(0);
}
try{process.loadEnvFile('.env.local');}catch{}
try{process.loadEnvFile('.env.admin.local');}catch{}
assert.equal(process.env.VITE_SUPABASE_URL??process.env.SUPABASE_URL,expectedUrl);
const publicKey=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(publicKey,'Public Supabase key required');
const credentials=await readJson(credentialsPath);
assert.ok(Array.isArray(credentials),'Prepare tmp/handover-accounts.json with the three requested emails and passwords');
const make=key=>createClient(expectedUrl,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=process.env.SUPABASE_SECRET_KEY?make(process.env.SUPABASE_SECRET_KEY):null;
const clients={};const users={};
const check=(stage,result)=>{if(result.error)throw Error(`${stage}: ${result.error.code??result.error.status??'request-failed'}`);return result.data;};
async function insertMissing(client,table,row,ownerColumn,owner){
 const found=check(`Read ${table}`,await client.from(table).select('*').eq('id',row.id).maybeSingle());
 if(found){assert.equal(found[ownerColumn],owner);return found;}
 return check(`Insert ${table}`,await client.from(table).insert(row).select('*').single());
}
try{
 // All three authenticated identities must be ready before seeding business records.
 for(const d of definitions){
  const account=credentials.find(a=>a.name===d.name);assert.equal(account?.email,d.name+'@logstar.test');assert.ok(account.password);
  const client=make(publicKey);clients[d.name]=client;
  let login=await client.auth.signInWithPassword({email:account.email,password:account.password});
  if(login.error&&createAccounts){
   assert.ok(admin,'Creating confirmed demo users needs SUPABASE_SECRET_KEY in .env.admin.local; the app Admin account cannot do this');
   const created=check(`Create ${d.name}`,await admin.auth.admin.createUser({email:account.email,password:account.password,email_confirm:true,app_metadata:{app_role:d.role,handover_batch:'customer-three-v1'},user_metadata:{full_name:d.fullName,registration_role:d.role}}));
   account.id=created.user.id;await writeFile(credentialsPath,JSON.stringify(credentials,null,2)+'\n',{mode:0o600});
   login=await client.auth.signInWithPassword({email:account.email,password:account.password});
  }
  const auth=check(`Login ${d.name}`,login);assert.ok(auth.user?.id&&auth.session);
  users[d.name]=auth.user.id;
  if(manifest.users[d.name])assert.equal(manifest.users[d.name],auth.user.id,'Manifest belongs to another account');
  let profile=check(`Profile ${d.name}`,await client.from('profiles').select('role,is_suspended,full_name').eq('id',auth.user.id).single());
  assert.equal(profile.is_suspended,false);
  if(!profile.role){
   check(`Registration metadata ${d.name}`,await client.auth.updateUser({data:{registration_role:d.role,full_name:d.fullName}}));
   const role=check(`Complete registration ${d.name}`,await client.rpc('complete_registration'));assert.equal(role,d.role);
  }else assert.equal(profile.role,d.role,'Wrong account role; never reassign automatically');
  manifest.users[d.name]=auth.user.id;account.id=auth.user.id;account.role=d.role;
 }
 await writeFile(credentialsPath,JSON.stringify(credentials,null,2)+'\n',{mode:0o600});
 await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 for(const d of definitions){
  const client=clients[d.name];const id=users[d.name];
  const existing=check(`Business profile ${d.name}`,await client.from(d.table).select('*').eq('user_id',id).maybeSingle());
  if(!existing)check(`Insert business profile ${d.name}`,await client.from(d.table).insert({user_id:id,...d.profile}));
  const p=check('Read personal display',await client.from('profiles').select('full_name').eq('id',id).single());
  if(!p.full_name||/^\[TEST\]|^(farmer|buyer|carrier)3$/i.test(p.full_name))check('Set display name',await client.from('profiles').update({full_name:d.fullName}).eq('id',id));
 }
 const catalog={types:check('Fruit catalog',await clients.farmer3.from('fruit_types').select('id,code,name,active')),varieties:check('Variety catalog',await clients.farmer3.from('fruit_varieties').select('id,code,name,active,fruit_type_id'))};
 const saved=[];
 for(const [index,p] of products.entries()){
  const pair=rows(p,index,catalog,users);
  pair.lot=await insertMissing(clients.farmer3,'lots',pair.lot,'farmer_id',users.farmer3);
  pair.request=await insertMissing(clients.buyer3,'buy_requests',pair.request,'buyer_id',users.buyer3);
  pair.vehicle=await insertMissing(clients.carrier3,'vehicles',pair.vehicle,'carrier_id',users.carrier3);
  saved.push(pair);
 }
 const checks=[];
 for(const pair of saved){
  const b=scoreBusiness(pair.lot,pair.request);assert.ok(b.eligible);assert.equal(b.priceFit,1);assert.equal(b.quantityFit,1);
  const buyer=rankMatches(saved.map(r=>({lot:r.lot})),pair.request,'rule-only',{catalog});
  const farmer=rankRequestMatches(saved.map(r=>({request:r.request})),pair.lot,'rule-only',{catalog});
  assert.equal(buyer[0]?.lot.id,pair.lot.id);assert.equal(farmer[0]?.request.id,pair.request.id);
  assert.equal(buyer[0].score,100);assert.equal(farmer[0].score,100);
  const visibleLot=check('Buyer visibility',await clients.buyer3.from('lots').select('id').eq('id',pair.lot.id).single());assert.equal(visibleLot.id,pair.lot.id);
  check('Farmer request visibility',await clients.farmer3.from('buy_requests').select('id').eq('id',pair.request.id).single());
  checks.push({title:pair.lot.title,lotId:pair.lot.id,requestId:pair.request.id,quantityKg:pair.lot.quantity_kg,ruleScore:buyer[0].score,vehicleCapacityKg:pair.vehicle.capacity_kg});
 }
 const cloud=[];
 if(cloudMatching)for(const [title,direction,client,sourceId,targetId] of saved.flatMap(pair=>[
  [pair.lot.title,'buyer-to-lots',clients.buyer3,pair.request.id,pair.lot.id],
  [pair.lot.title,'farmer-to-requests',clients.farmer3,pair.lot.id,pair.request.id],
 ])){
  const result=await client.functions.invoke('search-matches',{body:{direction,sourceId,text:'',page:1,pageSize:20}});
  if(result.error){cloud.push({title,direction,available:false,error:'Function request failed'});continue;}
  const items=result.data?.items??[];const position=items.findIndex(r=>(r.lot?.id??r.request?.id)===targetId);
  cloud.push({title,direction,available:true,mode:result.data?.meta?.mode,targetFound:position>=0,position:position>=0?position+1:null,score:position>=0?items[position].score:null});
 }
 const report={at:new Date().toISOString(),accounts:definitions.map(d=>({name:d.name,email:d.name+'@logstar.test',role:d.role})),businessChecks:checks,cloudMatching:cloud,carrierTripsCreated:false,existingRecordsReset:false};
 await writeFile('tmp/handover-data-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{for(const client of Object.values(clients))await client.auth.signOut({scope:'local'});}
