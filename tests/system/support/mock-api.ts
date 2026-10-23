// Test-only HTTP adapter. The production app always uses its real Supabase SDK.
import { expect, type Page } from '@playwright/test';
import { testCatalog, testLot } from '../../../src/features/farmer/lots/lot.fixtures';
import { installEnvironmentApi } from './environment-api';
export type TestRole = 'FARMER' | 'CARRIER' | 'BUYER' | 'ADMIN';
export const testIds = { FARMER: '30000000-0000-4000-8000-000000000001', CARRIER: '30000000-0000-4000-8000-000000000003', BUYER: '30000000-0000-4000-8000-000000000005', ADMIN: '30000000-0000-4000-8000-000000000006' };
type Row = Record<string, unknown>;
const phones: Record<TestRole, string> = { FARMER: '+84900000001', CARRIER: '+84900000003', BUYER: '+84900000005', ADMIN: '+84900000006' };
export async function installMockApi(page: Page, sharedDatabase?: Record<string, Row[]>, signupMode: 'confirm' | 'immediate' | 'error' = 'confirm') {
  await installEnvironmentApi(page);
  let role: TestRole = 'FARMER'; let active = false; let failPublish = 0; let failConnection = false;
  const calls: { method: string; table: string; body: Row | null }[] = [];
  const database: Record<string, Row[]> = sharedDatabase ?? {
    profiles: Object.entries(testIds).map(([role, id]) => ({ id, role, full_name: `Test ${role}`, phone_display: 'Test' })),
    trade_connections: [], trade_messages: [], trade_offers: [], trade_agreements: [], trade_reviews: [],
    notifications: [], transport_requests: [], buyer_profiles: [], buyer_evidence: [],
    farmer_profiles: [], carrier_profiles: [], vehicles: [], lot_images: [], lot_private_details: [],
    fruit_types: testCatalog.fruits.map(v => ({ ...v })), fruit_varieties: testCatalog.varieties.map(v => ({ ...v })),
    lots: [{ ...testLot({ id: '40000000-0000-4000-8000-000000000001', farmer_id: testIds.FARMER, status: 'PUBLISHED', quantity_kg: 5000 }) }],
    buy_requests: [{ id: '50000000-0000-4000-8000-000000000001', buyer_id: testIds.BUYER, status: 'OPEN', fruit_type_id: 'fruit-1', variety_id: null, title: 'Mua Ri6 test', target_quantity_kg: 10000, min_lot_quantity_kg: null, allow_partial: true, min_price_vnd_per_kg: 60000, max_price_vnd_per_kg: 70000, required_start: '2026-10-15', required_end: '2026-10-20', preferred_provinces: [], preferred_districts: [], quality_requirements: [], packaging_options: [], buying_method: 'PARTIAL', transport_by: 'UNDECIDED', notes: '', grade: null, created_at: '2026-10-17T00:00:00Z', updated_at: '2026-10-17T00:00:00Z' }],
    marketplace_profiles: [{ user_id: testIds.BUYER, display_name: 'Buyer công khai test', province: 'Tiền Giang', role: 'BUYER' }, { user_id: testIds.FARMER, display_name: 'Farmer công khai test', province: 'Tiền Giang', role: 'FARMER' }],
  };
  let registrationMetadata: Row | null = null;
  function user() { return { id: testIds[role], aud: 'authenticated', role: 'authenticated', phone: phones[role], app_metadata: { provider: 'phone' }, user_metadata: registrationMetadata ?? {}, created_at: '2026-10-15T00:00:00Z' }; }
  await page.route('http://127.0.0.1:54321/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const method = request.method();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range,x-supabase-api-version', 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' };
    const send = (value: unknown, status = 200, extra = {}) => route.fulfill({ status, headers: { ...headers, ...extra }, body: JSON.stringify(value) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...headers, 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS' } });
    if (url.pathname.endsWith('/signup')) {
      const body = request.postDataJSON() as { email: string; data: Row };
      calls.push({ method, table: 'auth_signup', body: { email: body.email, data: body.data } });
      if (signupMode === 'error') return send({ code: 'signup_disabled', msg: 'Signups disabled' }, 422);
      if (!['FARMER','BUYER','CARRIER'].includes(String(body.data.registration_role))) return send({ code: 'validation_failed', msg: 'Invalid role' }, 400);
      role = body.data.registration_role as TestRole; registrationMetadata = body.data;
      Object.assign(database.profiles.find(row => row.id === testIds[role])!, { role: null, full_name: body.data.full_name });
      if (signupMode === 'confirm') return send({ ...user(), email: body.email });
      active = true;
      const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: testIds[role], exp: Math.floor(Date.now()/1000)+3600, role: 'authenticated' })).toString('base64url')}.test-signature`;
      return send({ access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: `test-refresh-${role}`, user: user() });
    }
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
    if(url.pathname.includes('/storage/v1/object/sign/buyer-evidence/')) {
      if(method==='POST')return send({signedURL:'/object/sign/buyer-evidence/mock.png?token=test'});
      return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVYkAAAAASUVORK5CYII=','base64')});
    }
    if(url.pathname.includes('/storage/v1/object/buyer-evidence'))return send({Key:'mock',Id:'mock'});
    if (url.pathname.includes('/storage/v1/object/list/')) return send([]);
    if (/\/rpc\/(prepare_lot_deletion|delete_empty_lot)$/.test(url.pathname)) {
      const id = request.postDataJSON().lot_id; const lot = database.lots.find(row => row.id === id);
      calls.push({ method, table: url.pathname.split('/rpc/')[1], body: { lot_id: id } });
      if (!active || role !== 'FARMER' || lot?.farmer_id !== testIds.FARMER) return send({ code: '42501' }, 403);
      if (database.trade_connections.some(row => row.lot_id === id)) return send({ code: '23503' }, 409);
      if (url.pathname.endsWith('/prepare_lot_deletion')) lot.status = 'CLOSED';
      else if (database.lot_images.some(row => row.lot_id === id)) return send({ code: '23514' }, 409);
      else database.lots = database.lots.filter(row => row.id !== id);
      return send(null);
    }
    if (url.pathname.includes('/rest/v1/rpc/')) {
      const rpc = url.pathname.split('/rpc/')[1]; const args = request.postDataJSON() as Row;
      calls.push({ method, table: rpc, body: args });
      const actor = testIds[role];
      const denied = () => send({ message: 'Thao tác không được phép hoặc trạng thái đã thay đổi.' }, 403);
      if (rpc === 'mark_notifications_read' && active) {
        database.notifications.filter(n=>n.recipient_id===actor&&(!args.target_id||n.id===args.target_id)&&(!args.through_time||String(n.created_at)<=String(args.through_time))).forEach(n=>n.read_at=new Date().toISOString());return send(null);
      }
      if (rpc === 'my_review_summary' && active) {
        const rows=database.trade_reviews.filter(r=>r.target_id===actor);
        return send({count:rows.length,average:rows.length?rows.reduce((s,r)=>s+Number(r.rating),0)/rows.length:null,recent:rows.slice(-3).reverse().map(r=>({...r,reviewer_name:database.profiles.find(p=>p.id===r.reviewer_id)?.full_name??'Đối tác'}))});
      }
      if(rpc==='my_transport_sources'&&active){return send(database.lots.filter(l=>role==='FARMER'&&l.farmer_id===actor&&l.status==='PUBLISHED').map(l=>({lot_id:l.id,agreement_id:null,title:l.title,quantity_kg:l.quantity_kg,province:l.province,available_start:'2026-01-01',available_end:'2099-12-31'})));}
      if(rpc==='find_transport_vehicles'&&active){const rows=database.vehicles.filter(v=>v.active&&Number(v.capacity_kg)>=Number(args.kg)&&v.vehicle_type===args.required&&(v.provinces as string[]).includes(String(args.origin))&&(v.provinces as string[]).includes(String(args.destination))).map(v=>({...v,company_name:'Nhà xe kiểm thử'}));return send({items:rows,count:rows.length});}
      if(rpc==='create_transport_request'&&active){const vehicle=database.vehicles.find(v=>v.id===args.target_vehicle_id);const lot=database.lots.find(l=>l.id===args.target_lot_id);if(!vehicle||!lot)return denied();const id=crypto.randomUUID();database.transport_requests.push({id,requester_id:actor,carrier_id:vehicle.carrier_id,source_title:lot.title,carrier_name:'Nhà xe kiểm thử',vehicle_label:'Xe thùng kín',quantity_kg:args.kg,origin_province:args.origin,destination_province:args.destination,origin_address:args.origin_detail,destination_address:args.destination_detail,pickup_date:args.pickup,status:'PENDING',quote_vnd:null,quote_note:'',created_at:new Date().toISOString()});return send(id);}
      if(rpc==='respond_transport_request'&&active){const r=database.transport_requests.find(r=>r.id===args.target_id);if(!r||![r.requester_id,r.carrier_id].includes(actor))return denied();r.status=args.decision;if(args.decision==='QUOTED'){r.quote_vnd=args.price;r.quote_note=args.note;}return send(null);}
      if (rpc === 'complete_registration') {
        const profile = database.profiles.find(row => row.id === actor);
        if (!active || !profile || profile.is_suspended || !registrationMetadata || !['FARMER','BUYER','CARRIER'].includes(String(registrationMetadata.registration_role))) return denied();
        if (profile.role === null) profile.role = registrationMetadata.registration_role;
        return send(profile.role);
      }
      if(rpc==='save_buyer_business_profile'&&active&&role==='BUYER'){
        Object.assign(database.profiles.find(p=>p.id===actor)!,{full_name:(args.details as Row).full_name});
        const details:Row={...(args.details as Row),user_id:actor};delete details.full_name;
        const existing=database.buyer_profiles.find(p=>p.user_id===actor);if(existing)Object.assign(existing,details);else database.buyer_profiles.push(details);
        database.buyer_evidence=database.buyer_evidence.filter(e=>e.user_id!==actor);
        database.buyer_evidence.push(...(args.evidence as Row[]).map((x,i)=>({...x,user_id:actor,position:i})));return send(null);
      }
      if (rpc === 'buyer_market_summary'  && active && role === 'BUYER') return send([]);
      if (!active || !['BUYER', 'FARMER'].includes(role)) return denied();
      if (rpc === 'open_trade_connection') {
        if (failConnection) { failConnection = false; return send({ message: 'Không gửi được lời mời. Thử lại.' }, 409); }
        const lot = database.lots.find(row => row.id === args.target_lot_id);
        const demand = database.buy_requests.find(row => row.id === args.target_request_id);
        if (!lot || lot.status !== 'PUBLISHED' || (role === 'FARMER' && (lot.farmer_id !== actor || !demand))) return denied();
        const buyer = role === 'BUYER' ? actor : demand!.buyer_id;
        const existing = database.trade_connections.find(row => row.lot_id === lot.id && row.buyer_id === buyer);
        if (existing) return send(existing.id);
        const row = { id: crypto.randomUUID(), lot_id: lot.id, lot_title: lot.title, buy_request_id: demand?.id ?? null, buyer_id: buyer, farmer_id: lot.farmer_id, initiated_by: actor, status: 'PENDING', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        database.trade_connections.push(row); return send(row.id);
      }
      const target = rpc === 'respond_trade_offer' ? database.trade_offers.find(row => row.id === args.target_id)
        : rpc === 'complete_trade_agreement' || rpc === 'submit_trade_review' ? database.trade_agreements.find(row => row.id === (args.target_id ?? args.target_agreement_id)) : undefined;
      const connection = database.trade_connections.find(row => row.id === (target?.connection_id ?? args.target_connection_id ?? args.target_id));
      if (!connection || ![connection.buyer_id, connection.farmer_id].includes(actor)) return denied();
      if (rpc === 'respond_trade_connection') {
        const allowed = connection.initiated_by === actor ? args.decision === 'CANCELLED' : ['ACCEPTED', 'DECLINED'].includes(String(args.decision));
        if (connection.status !== 'PENDING' || !allowed) return denied();
        connection.status = args.decision; return send(null);
      }
      if (connection.status !== 'ACCEPTED') return denied();
      if (rpc === 'send_trade_message') {
        if (!database.trade_messages.some(row => row.id === args.message_id)) database.trade_messages.push({ id: args.message_id, connection_id: connection.id, sender_id: actor, body: args.message_body, created_at: new Date().toISOString() });
      } else if (rpc === 'propose_trade_offer') {
        database.trade_offers.push({ id: crypto.randomUUID(), connection_id: connection.id, proposed_by: actor, price_vnd_per_kg: args.price, quantity_kg: args.quantity, delivery_date: args.delivery, status: 'PENDING', created_at: new Date().toISOString() });
      } else if (rpc === 'respond_trade_offer') {
        if (!target || target.status !== 'PENDING' || (target.proposed_by === actor ? args.decision !== 'WITHDRAWN' : !['ACCEPTED', 'REJECTED'].includes(String(args.decision)))) return denied();
        target.status = args.decision;
        if (args.decision === 'ACCEPTED') {
          database.trade_agreements.push({ id: crypto.randomUUID(), connection_id: connection.id, offer_id: target.id, price_vnd_per_kg: target.price_vnd_per_kg, quantity_kg: target.quantity_kg, delivery_date: target.delivery_date, buyer_completed_at: null, farmer_completed_at: null, status: 'AGREED' });
          database.trade_offers.filter(row => row.connection_id === connection.id && row.status === 'PENDING').forEach(row => { row.status = 'SUPERSEDED'; });
        }
      } else if (rpc === 'complete_trade_agreement') {
        if (!target) return denied();
        target[actor === connection.buyer_id ? 'buyer_completed_at' : 'farmer_completed_at'] = new Date().toISOString();
        if (target.buyer_completed_at && target.farmer_completed_at) target.status = 'COMPLETED';
      } else if (rpc === 'submit_trade_review') {
        if (!target || target.status !== 'COMPLETED' || database.trade_reviews.some(row => row.agreement_id === target.id && row.reviewer_id === actor)) return denied();
        database.trade_reviews.push({ id: crypto.randomUUID(), agreement_id: target.id, reviewer_id: actor, target_id: actor === connection.buyer_id ? connection.farmer_id : connection.buyer_id, rating: args.stars, comment: args.review_comment, created_at: new Date().toISOString() });
      } else return send({ message: `Unmocked RPC ${rpc}` }, 400);
      return send(null);
    }
    const table = url.pathname.split('/rest/v1/')[1];
    if (!table || !database[table]) return send({ message: `Unmocked endpoint ${url.pathname}` }, 400);
    const body = request.postData() ? request.postDataJSON() as Row : null;
    calls.push({ method, table, body });
    const matches = (row: Row) => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
      if (value==='is.null') return row[key]===null||row[key]===undefined;
      if (value.startsWith('in.')) return value.slice(3).replace(/[()"]/g, '').split(',').includes(String(row[key]));
      if (value.startsWith('lte.')) return String(row[key]) <= value.slice(4);
      if (value.startsWith('gte.')) return String(row[key]) >= value.slice(4);
      if (value.startsWith('ilike.')) return String(row[key]).toLowerCase().includes(value.slice(6).replace(/%/g,'').toLowerCase());
      return true;
    });
    const participant = (row: Row) => [row.buyer_id, row.farmer_id].includes(testIds[role]);
    let rows = database[table].filter(matches).filter(row => {
      if (table === 'trade_connections') return participant(row);
      if (table === 'notifications') return row.recipient_id===testIds[role];
      if (table === 'transport_requests') return [row.requester_id,row.carrier_id].includes(testIds[role]);
      if (table === 'trade_reviews') return [row.reviewer_id, row.target_id].includes(testIds[role]);
      if (table.startsWith('trade_')) return database.trade_connections.some(connection => connection.id === row.connection_id && participant(connection));
      return true;
    });
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
  return { database, calls, failNextPublish: () => { failPublish = 1; }, failNextConnection: () => { failConnection = true; } };
}
export async function loginAs(page: Page, role: TestRole) {
  await page.goto('/login',{waitUntil:'domcontentloaded'}); await page.getByLabel(/^Email hoặc số điện thoại/).fill(phones[role]); await page.getByLabel(/^Mật khẩu/).fill('test-only-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(role === 'BUYER' ? /\/buyer\/dashboard$/ : role === 'ADMIN' ? /\/admin\/dashboard$/ : new RegExp(`/${role.toLowerCase()}/dashboard$`));
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
