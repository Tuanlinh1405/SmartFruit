import {ensureSeedProductPhoto} from './lib/seed-product-photo.mjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env.admin.local');
const expectedUrl = 'https://yyslykqpamnlqkvutrlm.supabase.co';
if (process.env.SUPABASE_URL !== expectedUrl || !process.env.SUPABASE_SECRET_KEY) {
  throw new Error('Seed is restricted to the LogStar test project and requires backend credentials.');
}
const admin = createClient(expectedUrl, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const credentialsPath = 'tmp/test-accounts.json';
const definitions = [
  ['buyer1', 'BUYER', 'Thu mua Vạn Đạt', 'Đồng Nai'],
  ['buyer2', 'BUYER', 'Thu mua An Bình', 'Tây Ninh'],
  ['farmer1', 'FARMER', 'Nhà vườn Minh Út', 'Đồng Nai'],
  ['farmer2', 'FARMER', 'HTX An Phú', 'Lâm Đồng'],
  ['carrier1', 'CARRIER', 'Vận tải Minh Phát', 'Đồng Nai'],
  ['carrier2', 'CARRIER', 'Vận tải An Khang', 'Tây Ninh'],
  ['admin1', 'ADMIN', 'Quản trị kiểm thử', 'Đồng Nai'],
];
await mkdir('tmp', { recursive: true });
let accounts = [];
try { accounts = JSON.parse(await readFile(credentialsPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const check = ({ data, error }) => { if (error) throw error; return data; };
for (const [name, role, label, province] of definitions) {
  let account = accounts.find(row => row.name === name);
  if (!account) {
    account = { name, email: `${name}@logstar.test`, role, password: randomBytes(18).toString('base64url') + 'aA1!' };
    const result = await admin.auth.admin.createUser({ email: account.email, password: account.password,
      email_confirm: true, app_metadata: { app_role: role, test_batch: 'logstar-test-v1' },
      user_metadata: { full_name: `[TEST] ${label}` } });
    if (result.error) throw new Error(`Create ${name}: ${result.error.message}. Existing accounts are never reset automatically.`);
    account.id = result.data.user.id;
    accounts.push(account);
    await writeFile(credentialsPath, JSON.stringify(accounts, null, 2) + '\n');
  }
  const { user } = check(await admin.auth.admin.getUserById(account.id));
  if (user.app_metadata.test_batch !== 'logstar-test-v1' || user.app_metadata.app_role !== role) {
    throw new Error(`Reserved test identity mismatch: ${name}`);
  }
  // Auth may write app_metadata after its INSERT trigger. Only this trusted
  // backend bootstrap can finish role assignment; clients cannot update role.
  const profile = check(await admin.from('profiles').select('id,role').eq('id', account.id).single());
  if (profile.role && profile.role !== role) throw new Error(`Existing profile role mismatch: ${name}`);
  if (!profile.role) check(await admin.from('profiles').update({ role }).eq('id', account.id));
  const table = role === 'BUYER' ? 'buyer_profiles' : role === 'FARMER' ? 'farmer_profiles' : 'carrier_profiles';
  if (role !== 'ADMIN') {
    const existing = check(await admin.from(table).select('user_id').eq('user_id', account.id).maybeSingle());
    if (!existing) {
      const labelField = role === 'BUYER' ? 'organization_name' : role === 'FARMER' ? 'farm_name' : 'company_name';
      check(await admin.from(table).insert({ user_id: account.id, [labelField]: `[TEST] ${label}`, province }));
    }
  }
  console.log(`READY ${name} ${role} ${account.email}`);
}
await writeFile('tmp/test-accounts.md', '# Tài khoản test LogStar\n\nChỉ dùng kiểm thử trên project yyslykqpamnlqkvutrlm. Giữ file này riêng, không commit hoặc đăng công khai.\n\n| Email | Role | Mật khẩu |\n| --- | --- | --- |\n' +
  accounts.map(row => `| ${row.email} | ${row.role} | ${row.password} |`).join('\n') + '\n');
const byName = Object.fromEntries(accounts.map(row => [row.name, row]));
const catalog = check(await admin.from('fruit_types').select('id,code'));
const varieties = check(await admin.from('fruit_varieties').select('id,code,fruit_type_id'));
const durian = catalog.find(row => row.code === 'durian');
const ri6 = varieties.find(row => row.code === 'ri6' && row.fruit_type_id === durian?.id);
if (!durian || !ri6) throw new Error('Fruit catalog is required.');
const businessPath = 'tmp/test-business-ids.json';
let ids;
try { ids = JSON.parse(await readFile(businessPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!ids) {
  ids = { lot1: randomUUID(), lot2: randomUUID(), draftLot: randomUUID(), request1: randomUUID(), request2: randomUUID() };
  await writeFile(businessPath, JSON.stringify(ids, null, 2) + '\n');
}
for (const key of ['vehicle1','vehicle2']) if (!ids[key]) ids[key] = randomUUID();
await writeFile(businessPath, JSON.stringify(ids, null, 2) + '\n');
for (const [key, owner, status, quantity, price] of [
  ['lot1', 'farmer1', 'PUBLISHED', 15000, 65000],
  ['lot2', 'farmer2', 'PUBLISHED', 20000, 68000],
  ['draftLot', 'farmer2', 'DRAFT', 5000, 63000],
]) {
  const insertedLot = check(await admin.from('lots').upsert({ id: ids[key], farmer_id: byName[owner].id,
    fruit_type_id: durian.id, variety_id: ri6.id, title: `[TEST] Ri6 ${key}`, grade: 'A',
    quantity_kg: quantity, price_vnd_per_kg: price, harvest_start: '2026-10-20', harvest_end: '2026-11-05',
    province: owner === 'farmer1' ? 'Đồng Nai' : 'Lâm Đồng', selling_method: 'PARTIAL', status: 'DRAFT',
    certifications: ['VietGAP'], packaging_options: ['CARTON'], description: 'Lô dùng cho kiểm thử xuyên vai trò.' },
  { onConflict: 'id', ignoreDuplicates: true }).select('id'));
  const photo = await ensureSeedProductPhoto(admin, ids[key]);
  if (status === 'PUBLISHED' && (insertedLot?.length || photo.created)) {
    check(await admin.from('lots').update({status}).eq('id',ids[key]).eq('status','DRAFT'));
  }
}
for (const [key, owner] of [['request1', 'buyer1'], ['request2', 'buyer2']]) {
  check(await admin.from('buy_requests').upsert({ id: ids[key], buyer_id: byName[owner].id,
    fruit_type_id: durian.id, variety_id: ri6.id, title: `[TEST] Thu mua Ri6 ${key}`,
    target_quantity_kg: 30000, min_lot_quantity_kg: 5000, allow_partial: true,
    min_price_vnd_per_kg: 60000, max_price_vnd_per_kg: 70000,
    required_start: '2026-10-20', required_end: '2026-11-05', status: 'OPEN',
    preferred_provinces: ['Đồng Nai', 'Lâm Đồng'] }, { onConflict: 'id', ignoreDuplicates: true }));
}
for (const [index, owner] of [['1','carrier1'],['2','carrier2']]) {
  check(await admin.from('vehicles').upsert({ id: ids[`vehicle${index}`],carrier_id:byName[owner].id,
    license_plate:`TEST-${index}-LOGSTAR`,vehicle_type:'REFRIGERATED',capacity_kg:15000,
    provinces:['Đồng Nai','Lâm Đồng'],min_temperature_c:4,max_temperature_c:8 }, {onConflict:'id',ignoreDuplicates:true}));
}
console.log(`Saved private credentials to ${credentialsPath}; never commit or publish this file.`);
console.log('Test business data ready:', Object.keys(ids).join(', '));
