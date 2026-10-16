// Test-only HTTP adapter. The production app always uses its real Supabase SDK.
import { expect, type Page } from '@playwright/test';
import { testCatalog, testLot } from '../../../src/features/farmer/lots/lot.fixtures';
export type TestRole = 'FARMER' | 'CARRIER' | 'BUYER' | 'ADMIN';
export const testIds = { FARMER: '30000000-0000-4000-8000-000000000001', CARRIER: '30000000-0000-4000-8000-000000000003', BUYER: '30000000-0000-4000-8000-000000000005', ADMIN: '30000000-0000-4000-8000-000000000006' };
type Row = Record<string, unknown>;
const phones: Record<TestRole, string> = { FARMER: '+84900000001', CARRIER: '+84900000003', BUYER: '+84900000005', ADMIN: '+84900000006' };
export async function installMockApi(page: Page) {
  let role: TestRole = 'FARMER'; let active = false; let failPublish = 0;
  const calls: { method: string; table: string; body: Row | null }[] = [];
  const database: Record<string, Row[]> = {
    profiles: Object.entries(testIds).map(([role, id]) => ({ id, role, full_name: `Test ${role}`, phone_display: 'Test' })),
    farmer_profiles: [], carrier_profiles: [], vehicles: [], lot_images: [], lot_private_details: [],
    fruit_types: testCatalog.fruits.map(v => ({ ...v })), fruit_varieties: testCatalog.varieties.map(v => ({ ...v })),
    lots: [{ ...testLot({ id: '40000000-0000-4000-8000-000000000001', farmer_id: testIds.FARMER, status: 'PUBLISHED', quantity_kg: 5000 }) }],
    buy_requests: [{ id: '50000000-0000-4000-8000-000000000001', buyer_id: testIds.BUYER, status: 'OPEN', fruit_type_id: 'fruit-1', variety_id: null, title: 'Mua Ri6 test', target_quantity_kg: 10000, min_lot_quantity_kg: null, allow_partial: true, min_price_vnd_per_kg: 60000, max_price_vnd_per_kg: 70000, required_start: '2026-10-15', required_end: '2026-10-20', preferred_provinces: [], preferred_districts: [], quality_requirements: [], packaging_options: [], buying_method: 'PARTIAL', transport_by: 'UNDECIDED', notes: '', grade: null, created_at: '2026-10-17T00:00:00Z', updated_at: '2026-10-17T00:00:00Z' }],
    marketplace_profiles: [{ user_id: testIds.BUYER, display_name: 'Buyer công khai test', province: 'Tiền Giang', role: 'BUYER' }],
  };
  function user() { return { id: testIds[role], aud: 'authenticated', role: 'authenticated', phone: phones[role], app_metadata: { provider: 'phone' }, user_metadata: {}, created_at: '2026-10-15T00:00:00Z' }; }
  await page.route('http://127.0.0.1:54321/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const method = request.method();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range', 'content-type': 'application/json' };
    const send = (value: unknown, status = 200, extra = {}) => route.fulfill({ status, headers: { ...headers, ...extra }, body: JSON.stringify(value) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...headers, 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS' } });
    if (url.pathname.endsWith('/token')) {
      const body = request.postDataJSON() as { phone?: string; email?: string }; const found = (Object.keys(phones) as TestRole[]).find(r => phones[r] === body.phone || `${r.toLowerCase()}@example.test` === body.email);
      if (!found) return send({ message: 'Invalid credentials' }, 400);
      role = found; active = true;
      // Valid JWT-shaped token; this is never accepted by a real Supabase server.
      const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: testIds[role], exp: Math.floor(Date.now()/1000)+3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
      return send({ access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: `test-refresh-${role}`, user: user() });
    }
    if (url.pathname.endsWith('/user')) return active ? send(user()) : send({ message: 'No session' }, 401);
    if (url.pathname.endsWith('/logout')) { active = false; return send({}); }
    if (url.pathname.includes('/storage/v1/object/list/')) return send([]);
    if (url.pathname.includes('/rest/v1/rpc/delete_empty_lot')) {
      const id = request.postDataJSON().lot_id; database.lots = database.lots.filter(row => row.id !== id); return send(null);
    }
    const table = url.pathname.split('/rest/v1/')[1];
    if (!table || !database[table]) return send({ message: `Unmocked endpoint ${url.pathname}` }, 400);
    const body = request.postData() ? request.postDataJSON() as Row : null;
    calls.push({ method, table, body });
    const matches = (row: Row) => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
      if (value.startsWith('in.')) return value.slice(3).replace(/[()"]/g, '').split(',').includes(String(row[key]));
      if (value.startsWith('lte.')) return String(row[key]) <= value.slice(4);
      if (value.startsWith('gte.')) return String(row[key]) >= value.slice(4);
      if (value.startsWith('ilike.')) return String(row[key]).toLowerCase().includes(value.slice(6).replace(/%/g,'').toLowerCase());
      return true;
    });
    let rows = database[table].filter(matches);
    if (method === 'POST') {
      const value: Row = { ...body };
      if (table === 'lots') Object.assign(value, { farmer_id: testIds[role], created_at: '2026-10-17T00:00:00Z', updated_at: '2026-10-17T00:00:00Z' });
      if (table === 'vehicles') Object.assign(value, { id: crypto.randomUUID(), carrier_id: testIds[role] });
      const conflict = url.searchParams.get('on_conflict'); const old = conflict && database[table].find(row => row[conflict] === value[conflict]);
      if (old) { Object.assign(old, value); rows = [old]; } else { database[table].push(value); rows = [value]; }
    } else if (method === 'PATCH') {
      if (body?.status === 'PUBLISHED' && failPublish-- > 0) return send({ message: 'Injected publish failure' }, 409);
      rows.forEach(row => Object.assign(row, body));
    } else if (method === 'DELETE') database[table] = database[table].filter(row => !matches(row));
    const count = rows.length; const offset = Number(url.searchParams.get('offset') ?? '0'); const limit = Number(url.searchParams.get('limit') ?? count);
    rows = rows.slice(offset, offset + limit);
    const projection = url.searchParams.get('select');
    if (projection && projection !== '*') rows = rows.map(row => Object.fromEntries(projection.split(',').map(key => [key, row[key]])));
    const singular = request.headers().accept?.includes('application/vnd.pgrst.object+json');
    if (singular && rows.length !== 1) return send({ code: 'PGRST116', message: 'No row', details: '0 rows' }, 406);
    return send(singular ? rows[0] : rows, 200, { 'content-range': `0-${Math.max(count-1,0)}/${count}` });
  });
  return { database, calls, failNextPublish: () => { failPublish = 1; } };
}
export async function loginAs(page: Page, role: TestRole) {
  await page.goto('/login'); await page.getByLabel(/^Email hoặc số điện thoại/).fill(phones[role]); await page.getByLabel(/^Mật khẩu/).fill('test-only-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(role === 'BUYER' ? /\/buyer$/ : role === 'ADMIN' ? /\/admin$/ : new RegExp(`/${role.toLowerCase()}/dashboard$`));
}
export async function logout(page: Page) {
  if (await page.getByRole('button', { name: 'Mở menu' }).isVisible()) await page.getByRole('button', { name: 'Mở menu' }).click();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function useMenu(page: Page, name: string) {
  let link = page.getByRole('link', { name, exact: true }).filter({ visible: true });
  if (!(await link.count())) await page.getByRole('button', { name: 'Mở menu' }).click();
  link = page.getByRole('link', { name, exact: true }).filter({ visible: true }); await link.first().click();
}
