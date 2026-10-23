// Real Auth/DB/Storage suite. Dedicated accounts only; never reset shared data.
import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
const enabled = process.env.RUN_A_LIVE === '1';
const tag = `a-ui-${randomUUID()}`;
type Account = { phone?: string; email?: string; password: string };
const roles = ['farmer1','farmer2','carrier1','carrier2','buyer','admin'] as const;
type Key = typeof roles[number];
const clients = {} as Record<Key, SupabaseClient>; const ids = {} as Record<Key, string>;
let accounts: Record<Key, Account>; let fruitId = ''; let createdLotId = '';
const vehiclePlates = new Set<string>();
const lotIds = new Set<string>(); const requestIds = new Set<string>(); const vehicleIds = new Set<string>();
const savedProfiles: { key: Key; table: string; value: Record<string, unknown> | null; columns: string[] }[] = [];
async function okay<T extends { error: unknown }>(result: T): Promise<T> { expect(Boolean(result.error), 'Supabase request must succeed').toBe(false); return result; }
async function signIn(page: Page, key: Key) {
  try {
    await page.goto('/login'); await page.getByLabel(/^Email hoặc số điện thoại/).fill(accounts[key].email ?? accounts[key].phone ?? ''); await page.getByLabel(/^Mật khẩu/).fill(accounts[key].password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await expect(page).not.toHaveURL(/\/login$/);
  } catch { throw new Error(`Không đăng nhập được tài khoản test ${key}; kiểm tra cấu hình local.`); }
}
async function signOut(page: Page) {
  const menu = page.getByRole('button', { name: 'Mở menu' }); if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).filter({ visible: true }).first().click(); await expect(page).toHaveURL(/\/login$/);
}
test.describe('A real authenticated production routes', () => {
  test.skip(!enabled, 'Requires local test accounts and reviewed cloud migrations; not verified.');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  test.beforeAll(async () => {
    accounts = JSON.parse(process.env.A_TEST_ACCOUNTS ?? '{}');
    for (const key of roles) {
      expect(Boolean((accounts[key]?.phone || accounts[key]?.email) && accounts[key]?.password), `Missing ${key} credentials`).toBe(true);
      const client = createClient(process.env.A_TEST_SUPABASE_URL!, process.env.A_TEST_SUPABASE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }); clients[key] = client;
      const login = await okay(await client.auth.signInWithPassword(accounts[key].email ? { email: accounts[key].email!, password: accounts[key].password } : { phone: accounts[key].phone!, password: accounts[key].password })); ids[key] = login.data.user!.id;
      const profile = await okay(await client.from('profiles').select('role').eq('id', ids[key]).single()); expect(profile.data?.role).toBe(key.replace(/\d$/, '').toUpperCase());
    }
    expect(new Set(Object.values(ids)).size, 'Use distinct dedicated accounts').toBe(6);
    for (const [key, table, columns] of [
      ['farmer1','farmer_profiles',['farm_name','province','district','address','latitude','longitude','area_m2','tree_count','orchard_age_years','annual_yield_kg','cultivated_varieties','certifications','growing_area_code']],
      ['carrier1','carrier_profiles',['company_name','province','address','service_provinces']],
    ] as const) {
      const old = await okay(await clients[key].from(table).select(columns.join(',')).eq('user_id', ids[key]).maybeSingle());
      savedProfiles.push({ key, table, value: old.data as Record<string, unknown> | null, columns: [...columns] });
    }
    const catalog = await okay(await clients.farmer1.from('fruit_types').select('id').eq('active',true).limit(1).single()); fruitId = catalog.data!.id;
  });
  test.afterAll(async () => {
    const failures: string[] = [];
    // Recover tagged creations even if a response/navigation failed before its ID was recorded.
    if (clients.farmer1 && ids.farmer1) try { const tagged = await okay(await clients.farmer1.from('lots').select('id').eq('farmer_id',ids.farmer1).eq('title',tag)); for (const row of tagged.data ?? []) lotIds.add(row.id); } catch { failures.push('tagged-lot-discovery'); }
    for (const plate of vehiclePlates) try { const tagged = await okay(await clients.carrier1.from('vehicles').select('id').eq('carrier_id',ids.carrier1).eq('license_plate',plate)); for (const row of tagged.data ?? []) vehicleIds.add(row.id); } catch { failures.push('tagged-vehicle-discovery'); }
    for (const id of lotIds) try {
      const links = await okay(await clients.farmer1.from('lot_images').select('storage_path').eq('lot_id',id));
      await okay(await clients.farmer1.from('lot_images').delete().eq('lot_id',id));
      const bucket = clients.farmer1.storage.from('lot-images'); const folder = `${ids.farmer1}/${id}`;
      const objects = await okay(await bucket.list(folder, { limit: 1000 }));
      const paths = new Set([...(links.data ?? []).map(row => row.storage_path), ...(objects.data ?? []).map(row => `${folder}/${row.name}`)]);
      if (paths.size) await okay(await bucket.remove([...paths]));
      const row = await okay(await clients.farmer1.from('lots').select('id').eq('id',id).maybeSingle()); if (row.data) await okay(await clients.farmer1.rpc('delete_empty_lot',{ lot_id:id }));
    } catch { failures.push(`lot:${id}`); }
    for (const id of requestIds) try { await okay(await clients.buyer.from('buy_requests').delete().eq('id',id)); } catch { failures.push(`request:${id}`); }
    for (const id of vehicleIds) try { await okay(await clients.carrier1.from('vehicles').delete().eq('id',id)); } catch { failures.push(`vehicle:${id}`); }
    for (const old of savedProfiles) try {
      const client = clients[old.key];
      if (old.value) await okay(await client.from(old.table).update(old.value).eq('user_id',ids[old.key]));
      else await okay(await client.from(old.table).delete().eq('user_id',ids[old.key]));
    } catch { failures.push(`profile:${old.key}`); }
    for (const client of Object.values(clients)) await client.auth.signOut();
    expect(failures, 'Cleanup must succeed; only IDs are reported').toEqual([]);
  });
  test('Farmer persists profile, lot/image/private data; matches Buyer; closes/deletes', async ({ page }) => {
    await signIn(page,'farmer1'); await page.goto('/farmer/profile');
    await page.getByLabel(/^Tên vườn/).fill(''); await page.getByRole('button',{ name:'Lưu hồ sơ',exact:true }).click();
    const invalid = await okay(await clients.farmer1.from('farmer_profiles').select('farm_name').eq('user_id',ids.farmer1).maybeSingle()); expect(invalid.data?.farm_name ?? null).toBe(savedProfiles[0].value?.farm_name ?? null);
    await page.getByLabel(/^Tên vườn/).fill(tag); await page.getByLabel(/^Tỉnh \/ thành phố/).fill('Tiền Giang'); await page.getByRole('button',{ name:'Lưu hồ sơ',exact:true }).click(); await expect(page.getByText('Đã lưu hồ sơ nhà vườn.')).toBeVisible();
    await page.reload(); await expect(page.getByLabel(/^Tên vườn/)).toHaveValue(tag);
    await page.goto('/farmer/lots/new'); await page.getByLabel(/^Tên lô hàng/).fill(tag); await page.getByRole('combobox',{name:/Loại quả/}).fill('sau rieng');await page.getByRole('option',{name:'Sầu riêng',exact:true}).click(); await page.getByLabel(/^Khối lượng/).fill('1'); await page.getByLabel(/^Giá chào/).fill('65000');
    await page.getByLabel(/^Bắt đầu thu hoạch/).fill('2026-10-15'); await page.getByLabel(/^Kết thúc thu hoạch/).fill('2026-10-20'); await page.getByLabel(/^Tỉnh \/ thành phố/).fill('Tiền Giang');
    await page.getByRole('button',{ name:'Lưu nháp',exact:true }).click(); await expect(page).toHaveURL(/\/farmer\/lots\/[^/]+\/edit$/);
    createdLotId = new URL(page.url()).pathname.split('/')[3]; lotIds.add(createdLotId);
    const png = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width=2;c.height=2;return c.toDataURL('image/png').split(',')[1]; }),'base64');
    await page.getByLabel('Chọn ảnh lô hàng').setInputFiles({ name:'a-test.png',mimeType:'image/png',buffer:png }); await page.getByRole('button',{ name:'Đăng lô hàng',exact:true }).click(); await expect(page.getByText('Đã lưu lô đã đăng.')).toBeVisible(); await expect(page.getByRole('img',{ name:'Ảnh lô 1',exact:true })).toBeVisible();
    await page.getByLabel('Giá sàn riêng (đ/kg)').fill('60000'); await page.getByLabel('Ghi chú nội bộ').fill(`${tag}-private`); await page.getByRole('button',{name:'Lưu thông tin riêng',exact:true}).click(); await expect(page.getByText('Đã lưu thông tin riêng.')).toBeVisible();
    await page.reload(); await expect(page.getByLabel('Giá sàn riêng (đ/kg)')).toHaveValue('60000');
    const buyer = await okay(await clients.buyer.from('lots').select('id,title').eq('id',createdLotId).single()); expect(buyer.data?.title).toBe(tag);
    expect((await clients.buyer.from('lot_private_details').select('lot_id').eq('lot_id',createdLotId)).data).toEqual([]);
    expect((await clients.farmer2.from('lots').select('id').eq('id',createdLotId)).data).toEqual([]);
    const requestId = randomUUID(); requestIds.add(requestId); await okay(await clients.buyer.from('buy_requests').insert({ id:requestId,title:tag,fruit_type_id:fruitId,target_quantity_kg:2000,min_price_vnd_per_kg:60000,max_price_vnd_per_kg:70000,required_start:'2026-10-15',required_end:'2026-10-20',status:'OPEN',allow_partial:true }));
    await page.goto(`/farmer/matches?lotId=${createdLotId}`); await expect(page.getByText(new RegExp(`${tag} ·`))).toBeVisible();
    await page.goto(`/farmer/lots/${createdLotId}`); await page.getByRole('button',{name:'Đóng lô',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Xác nhận',exact:true}).click();
    await expect(page.getByRole('button',{name:'Tìm người mua phù hợp'})).toBeDisabled(); expect((await clients.buyer.from('lots').select('id').eq('id',createdLotId)).data).toEqual([]);
    await page.getByRole('button',{name:'Xóa lô',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Xác nhận',exact:true}).click(); await expect(page).toHaveURL(/\/farmer\/lots$/);
    await signOut(page); await signIn(page,'farmer1'); await page.goto('/farmer/profile'); await expect(page.getByLabel(/^Tên vườn/)).toHaveValue(tag);
  });
  test('Carrier persists profile and vehicle, edits/deactivates/deletes and guards Farmer', async ({ page }) => {
    await signIn(page,'carrier1'); await page.goto('/carrier/vehicles'); await page.getByLabel(/^Tên đơn vị vận tải/).fill(tag); await page.getByLabel(/^Tỉnh \/ thành phố/).fill('Tiền Giang'); await page.getByRole('button',{name:'Lưu hồ sơ nhà xe',exact:true}).click();
    const plate = `T-${randomUUID().slice(0,8)}`; vehiclePlates.add(plate); await page.getByRole('button',{name:'Thêm xe',exact:true}).click(); const modal = page.getByRole('dialog'); await modal.getByLabel(/^Biển số/).fill(plate); await modal.getByLabel(/^Tải trọng/).fill('5'); await modal.getByRole('button',{name:'Lưu xe',exact:true}).click(); await expect(modal).toHaveCount(0);
    const vehicle = await okay(await clients.carrier1.from('vehicles').select('id').eq('license_plate',plate).single()); vehicleIds.add(vehicle.data!.id);
    await page.reload(); await page.getByRole('button',{name:`Sửa ${plate}`,exact:true}).click(); await modal.getByLabel(/^Tải trọng/).fill('6'); await modal.getByRole('button',{name:'Lưu xe',exact:true}).click(); await expect(modal).toHaveCount(0);
    await page.getByRole('button',{name:`Ngừng ${plate}`,exact:true}).click(); await expect(page.getByRole('button',{name:`Kích hoạt ${plate}`,exact:true})).toBeVisible();
    expect((await clients.carrier2.from('vehicles').select('id').eq('id',vehicle.data!.id)).data).toEqual([]);
    await signOut(page); await signIn(page,'carrier1'); await page.goto('/carrier/vehicles'); await expect(page.getByRole('button',{name:`Kích hoạt ${plate}`,exact:true})).toBeVisible();
    await page.getByRole('button',{name:`Xóa ${plate}`,exact:true}).click(); await page.getByRole('button',{name:'Xác nhận xóa xe',exact:true}).click(); await expect(page.getByRole('button',{name:`Sửa ${plate}`,exact:true})).toHaveCount(0);
    await page.goto('/farmer/lots'); await expect(page).toHaveURL(/\/403$/); await page.goto('/carrier/dashboard'); await signOut(page); await page.goto('/carrier/vehicles'); await expect(page).toHaveURL(/\/login$/);
  });
});
