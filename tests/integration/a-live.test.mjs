// Opt-in SDK integration, dedicated accounts only. Never provisions users or deploys SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
const enabled = process.env.RUN_A_LIVE === '1';
test('A integration via Auth / PostgREST / Storage HTTP', { skip: !enabled ? 'Requires RUN_A_LIVE=1 and dedicated accounts from B; not verified' : false }, async t => {
  const url = process.env.A_TEST_SUPABASE_URL; const key = process.env.A_TEST_SUPABASE_KEY;
  assert.ok(url && key?.startsWith('sb_publishable_'), 'Configure public Supabase URL/key for the dedicated test environment');
  let accounts; try { accounts = JSON.parse(process.env.A_TEST_ACCOUNTS ?? '{}'); } catch { throw new Error('Invalid A_TEST_ACCOUNTS JSON; do not print credentials'); }
  const clients = {}; const ids = {}; const lotIds = []; const vehicleIds = []; const paths = []; const createdProfiles = [];
  const tag = `a-test-${randomUUID()}`; const bucketName = 'lot-images';
  const ok = result => assert.equal(result.error?.code ?? null, null, 'SDK request failed');
  async function insert(table, value, client = clients.farmer1) { const r = await client.from(table).insert(value).select('id').single(); ok(r); return r.data.id; }
  try {
    for (const role of ['farmer1', 'farmer2', 'carrier1', 'carrier2', 'buyer', 'admin']) {
      assert.ok((accounts[role]?.phone || accounts[role]?.email) && accounts[role]?.password, `Missing dedicated ${role} credentials`);
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); clients[role] = client;
      const login = await client.auth.signInWithPassword(accounts[role].email ? { email: accounts[role].email, password: accounts[role].password } : { phone: accounts[role].phone, password: accounts[role].password }); ok(login); assert.ok(login.data.user); ids[role] = login.data.user.id;
      const profile = await client.from('profiles').select('role').eq('id', ids[role]).single(); ok(profile);
      assert.equal(profile.data.role, role.replace(/\d$/, '').toUpperCase(), 'Dedicated account role mismatch');
    }
    assert.equal(new Set(Object.values(ids)).size, 6, 'Use six distinct dedicated test accounts');
    for (const role of ['farmer1', 'farmer2', 'carrier1', 'carrier2']) {
      const table = role.startsWith('farmer') ? 'farmer_profiles' : 'carrier_profiles'; const client = clients[role];
      const existing = await client.from(table).select('user_id').eq('user_id', ids[role]).maybeSingle(); ok(existing);
      if (!existing.data) {
        const profile = { user_id: ids[role], province: 'Test', ...(role.startsWith('farmer') ? { farm_name: tag } : { company_name: tag }) };
        ok(await client.from(table).insert(profile)); createdProfiles.push({ table, role });
      }
    }
    await t.test('Farmer/Carrier profiles persist, reject invalid values and remain owner-only', async () => {
      for (const role of ['farmer1', 'carrier1']) {
        const table = role === 'farmer1' ? 'farmer_profiles' : 'carrier_profiles';
        const column = role === 'farmer1' ? 'farm_name' : 'company_name'; const other = role === 'farmer1' ? 'farmer2' : 'carrier2';
        const old = await clients[role].from(table).select(column).eq('user_id', ids[role]).single(); ok(old);
        try {
          const update = await clients[role].from(table).update({ [column]: tag }).eq('user_id', ids[role]).select(column).single(); ok(update); assert.equal(update.data[column], tag);
          const read = await clients[role].from(table).select(column).eq('user_id', ids[role]).single(); ok(read); assert.equal(read.data[column], tag);
          assert.ok((await clients[role].from(table).update({ [column]: '' }).eq('user_id', ids[role])).error);
          const hidden = await clients[other].from(table).select('user_id').eq('user_id', ids[role]); ok(hidden); assert.deepEqual(hidden.data, []);
          const forged = await clients[other].from(table).update({ [column]: 'forged' }).eq('user_id', ids[role]).select('user_id'); assert.ok(forged.error || forged.data?.length === 0);
        } finally { ok(await clients[role].from(table).update({ [column]: old.data[column] }).eq('user_id', ids[role])); }
      }
    });
    const fruit = await clients.farmer1.from('fruit_types').select('id').eq('active', true).limit(1).single(); ok(fruit);
    const input = { title: tag, fruit_type_id: fruit.data.id, quantity_kg: 5000, price_vnd_per_kg: 65000, harvest_start: '2026-10-15', harvest_end: '2026-10-20', province: 'Test', status: 'DRAFT' };
    const id = randomUUID(); lotIds.push(id); ok(await clients.farmer1.from('lots').insert({ ...input, id }));
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jc1sAAAAASUVORK5CYII=', 'base64');
    await t.test('owner CRUD persists; second Farmer and wrong roles cannot read/update; owner immutable', async () => {
      ok(await clients.farmer1.from('lots').update({ title: `${tag}-updated` }).eq('id', id));
      const reread = await clients.farmer1.from('lots').select('title').eq('id', id).single(); ok(reread); assert.equal(reread.data.title, `${tag}-updated`);
      for (const role of ['farmer2', 'carrier1', 'admin', 'buyer']) { const read = await clients[role].from('lots').select('id').eq('id', id); assert.equal(read.data?.length ?? 0, 0); }
      const update = await clients.farmer2.from('lots').update({ title: 'forged' }).eq('id', id).select('id'); assert.ok(update.error || !update.data?.length);
      assert.ok((await clients.farmer1.from('lots').update({ farmer_id: ids.farmer2 }).eq('id', id)).error);
      assert.ok((await clients.farmer1.from('profiles').update({ role: 'ADMIN' }).eq('id', ids.farmer1)).error);
    });
    await t.test('private floor is hidden and constrains asking price', async () => {
      ok(await clients.farmer1.from('lot_private_details').insert({ lot_id: id, price_floor_vnd_per_kg: 60000, internal_notes: tag }));
      const hidden = await clients.buyer.from('lot_private_details').select('lot_id').eq('lot_id', id); assert.equal(hidden.data?.length ?? 0, 0);
      assert.ok((await clients.farmer1.from('lots').update({ price_vnd_per_kg: 59000 }).eq('id', id)).error);
    });
    const path = `${ids.farmer1}/${id}/${randomUUID()}.png`; paths.push(path);
    await t.test('Storage upload/link, published Buyer read and private signed URL', async () => {
      const bucket = clients.farmer1.storage.from(bucketName); ok(await bucket.upload(path, png, { contentType: 'image/png', upsert: false }));
      ok(await clients.farmer1.from('lot_images').insert({ lot_id: id, storage_path: path, sort_order: 0 }));
      assert.ok((await clients.buyer.storage.from(bucketName).createSignedUrl(path, 1)).error);
      ok(await clients.farmer1.from('lots').update({ status: 'PUBLISHED' }).eq('id', id));
      const published = await clients.buyer.from('lots').select('id').eq('id', id).single(); ok(published);
      const signed = await clients.buyer.storage.from(bucketName).createSignedUrl(path, 1); ok(signed);
      assert.equal((await fetch(signed.data.signedUrl)).status, 200); await delay(2200); assert.notEqual((await fetch(signed.data.signedUrl)).status, 200);
      assert.ok((await clients.farmer2.storage.from(bucketName).upload(`${ids.farmer1}/${id}/forged.png`, png, { contentType: 'image/png' })).error);
      assert.ok((await bucket.upload(`${ids.farmer1}/${id}/bad.svg`, '<svg/>', { contentType: 'image/svg+xml' })).error);
      const tooBig = `${ids.farmer1}/${id}/too-big.png`; paths.push(tooBig); assert.ok((await bucket.upload(tooBig, new Uint8Array(5242881), { contentType: 'image/png' })).error);
    });
    await t.test('replacement RPC, linked delete guard, cleanup and final lot delete', async () => {
      const image = await clients.farmer1.from('lot_images').select('id').eq('lot_id', id).single(); ok(image);
      const next = `${ids.farmer1}/${id}/${randomUUID()}.png`; paths.push(next); ok(await clients.farmer1.storage.from(bucketName).upload(next, png, { contentType: 'image/png' }));
      assert.ok((await clients.farmer2.rpc('replace_lot_image', { image_id: image.data.id, new_path: next })).error);
      ok(await clients.farmer1.rpc('replace_lot_image', { image_id: image.data.id, new_path: next }));
      assert.ok((await clients.farmer1.rpc('delete_empty_lot', { lot_id: id })).error);
      ok(await clients.farmer1.from('lot_images').delete().eq('lot_id', id)); ok(await clients.farmer1.storage.from(bucketName).remove([path, next]));
      ok(await clients.farmer1.rpc('delete_empty_lot', { lot_id: id }));
    });
    await t.test('Carrier CRUD, duplicate normalized plate and cross-owner restrictions', async () => {
      const vehicleId = randomUUID(); vehicleIds.push(vehicleId);
      const vehicle = { id: vehicleId, license_plate: `T-${randomUUID().slice(0, 8)}`, capacity_kg: 5000, vehicle_type: 'REFRIGERATED', min_temperature_c: 0, max_temperature_c: 4 };
      await insert('vehicles', vehicle, clients.carrier1);
      const hidden = await clients.carrier2.from('vehicles').select('id').eq('id', vehicleId); assert.equal(hidden.data?.length ?? 0, 0);
      assert.ok((await clients.carrier1.from('vehicles').insert({ ...vehicle, id: randomUUID(), license_plate: vehicle.license_plate.toLowerCase().replace('-', ' ') })).error);
      ok(await clients.carrier1.from('vehicles').update({ active: false }).eq('id', vehicleId));
      assert.ok((await clients.carrier1.from('vehicles').update({ min_temperature_c: 10, max_temperature_c: 4 }).eq('id', vehicleId)).error);
    });
    await t.test('simultaneous upload and delete cannot leave object metadata without its lot', async () => {
      for (let round = 0; round < 3; round++) {
        const raceId = randomUUID(); lotIds.push(raceId); ok(await clients.farmer1.from('lots').insert({ ...input, id: raceId }));
        const racePath = `${ids.farmer1}/${raceId}/${randomUUID()}.png`; paths.push(racePath);
        const [upload, deletion] = await Promise.all([
          clients.farmer1.storage.from(bucketName).upload(racePath, png, { contentType: 'image/png' }),
          clients.farmer1.rpc('delete_empty_lot', { lot_id: raceId }),
        ]);
        const exists = await clients.farmer1.from('lots').select('id').eq('id', raceId).maybeSingle(); ok(exists);
        const folder = await clients.farmer1.storage.from(bucketName).list(`${ids.farmer1}/${raceId}`); ok(folder);
        assert.ok(exists.data || folder.data.length === 0, 'Upload/delete race left orphan object metadata');
        assert.ok(upload.error || deletion.error, 'Upload and final deletion cannot both commit successfully');
      }
    });
    await t.test('anonymous cannot query application tables', async () => { const anon = createClient(url, key); assert.ok((await anon.from('lots').select('id')).error); });
  } finally {
    const failures = [];
    for (const id of lotIds) {
      try { ok(await clients.farmer1.from('lot_images').delete().eq('lot_id', id)); ok(await clients.farmer1.storage.from(bucketName).remove(paths.filter(p => p.split('/')[1] === id))); const exists = await clients.farmer1.from('lots').select('id').eq('id', id).maybeSingle(); if (exists.data) ok(await clients.farmer1.rpc('delete_empty_lot', { lot_id: id })); } catch { failures.push(`lot ${id}`); }
    }
    for (const id of vehicleIds) { try { ok(await clients.carrier1.from('vehicles').delete().eq('id', id)); } catch { failures.push(`vehicle ${id}`); } }
    for (const { table, role } of createdProfiles) { try { ok(await clients[role].from(table).delete().eq('user_id', ids[role])); } catch { failures.push(`profile ${role}`); } }
    for (const client of Object.values(clients)) await client.auth.signOut();
    assert.deepEqual(failures, [], 'Test cleanup incomplete; inspect test resource IDs');
  }
});
