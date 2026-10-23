// Idempotent, explicitly labeled presentation requests for the three handover accounts.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
try{process.loadEnvFile('.env.local');}catch{}
const apply=process.argv.includes('--apply');
const url=process.env.VITE_SUPABASE_URL;
assert.equal(url,'https://yyslykqpamnlqkvutrlm.supabase.co');
assert.ok(process.env.SUPABASE_SECRET_KEY,'Backend key required');
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const check=r=>{if(r.error)throw Error(`Database request failed (${r.error.code??r.status})`);return r.data;};
const accounts=JSON.parse(await readFile('tmp/handover-accounts.json','utf8'));
const manifest=JSON.parse(await readFile('tmp/handover-data-manifest.json','utf8'));
const trades=JSON.parse(await readFile('tmp/customer-reviews-manifest.json','utf8'));
assert.equal(manifest.project,url);assert.equal(trades.project,url);
const users={};
for(const [name,role] of [['farmer3','FARMER'],['buyer3','BUYER'],['carrier3','CARRIER']]){
 const account=accounts.find(a=>a.name===name);assert.equal(account?.email,`${name}@logstar.test`);
 const id=account.id??manifest.users[name];assert.ok(id);
 const identity=check(await admin.auth.admin.getUserById(id));assert.equal(identity.user.email,account.email);
 const p=check(await admin.from('profiles').select('role,is_suspended').eq('id',id).single());assert.equal(p.role,role);assert.equal(p.is_suspended,false);users[name]=id;
}
const company=check(await admin.from('carrier_profiles').select('company_name').eq('user_id',users.carrier3).single());
const vehicles=check(await admin.from('vehicles').select('*').eq('carrier_id',users.carrier3));assert.ok(vehicles.length);
// Read only agreements belonging to the named presentation pair; never use unrelated users.
const connections=check(await admin.from('trade_connections').select('id,lot_id').eq('buyer_id',users.buyer3).eq('farmer_id',users.farmer3));
const agreements=connections.length?check(await admin.from('trade_agreements').select('*').in('id',trades.trades.map(t=>t.agreement)).in('connection_id',connections.map(c=>c.id))):[];
const keys=Object.keys(manifest.ids);assert.ok(keys.length>=2);assert.ok(agreements.length,'Seed the handover sample agreements first');
const uuid=key=>{const h=createHash('sha256').update(`${users.carrier3}:feedback-20261023:${key}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
const results=[];
for(let i=0;i<3;i++){
 const id=uuid(i);const existing=check(await admin.from('transport_requests').select('id,status,requester_id,carrier_id,source_title').eq('id',id).maybeSingle());
 if(existing){assert.equal(existing.carrier_id,users.carrier3);assert.ok(existing.source_title.startsWith('[MẪU]'));results.push({sample:i+1,existing:true,status:existing.status});continue;}
 const buyer=i===2;const agreement=buyer?agreements[0]:null;
 const lotId=buyer?connections.find(c=>c.id===agreement.connection_id).lot_id:manifest.ids[keys[i]].lot;
 const lot=check(await admin.from('lots').select('*').eq('id',lotId).eq('farmer_id',users.farmer3).single());
 const vehicle=vehicles.find(v=>Number(v.capacity_kg)>=Math.min(Number(lot.quantity_kg),1000))??vehicles[0];
 const requester=buyer?users.buyer3:users.farmer3,source=buyer?`agreement:${agreement.id}`:`lot:${lot.id}`;
 const active=check(await admin.from('transport_requests').select('id').eq('requester_id',requester).eq('source_key',source).in('status',['PENDING','QUOTED','ACCEPTED']));
 if(active.length){results.push({sample:i+1,skipped:'An existing active request already uses this source'});continue;}
 const status=['PENDING','QUOTED','ACCEPTED'][i];
 const row={id,requester_id:requester,carrier_id:users.carrier3,vehicle_id:vehicle.id,lot_id:lot.id,agreement_id:agreement?.id??null,source_key:source,source_title:`[MẪU] ${lot.title}`,carrier_name:company.company_name,vehicle_label:vehicle.license_plate,quantity_kg:Math.min(Number(lot.quantity_kg),1000),origin_province:lot.province,destination_province:'Hồ Chí Minh',origin_address:'[MẪU] Điểm tập kết nhà vườn',destination_address:'[MẪU] Kho thu mua Thủ Đức',pickup_date:agreement?.delivery_date??lot.harvest_start,required_type:vehicle.vehicle_type,status,quote_vnd:i?1800000+i*200000:null,quote_note:i?'[MẪU] Báo giá trình diễn, không phải cam kết vận chuyển.':''};
 if(apply)check(await admin.from('transport_requests').insert(row));results.push({sample:i+1,status,written:apply});
}
console.log(JSON.stringify({mode:apply?'APPLIED':'DRY_RUN',account:'carrier3@logstar.test',results},null,2));
