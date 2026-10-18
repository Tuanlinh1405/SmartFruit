// Only creates and deletes its own disposable lot; never selects an existing lot for deletion.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries((await readFile(new URL('../.env.local', import.meta.url), 'utf8')).split(/\r?\n/)
  .map(line => line.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY)\s*=\s*(.*?)\s*$/))
  .filter(Boolean).map(match => [match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]));
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const accounts = JSON.parse(await readFile(new URL('../tmp/test-accounts.json', import.meta.url), 'utf8'));
const farmer = accounts.find(account => account.name === 'farmer1');
assert.ok(farmer, 'Need farmer1 in ignored tmp/test-accounts.json');
const { data: auth, error: authError } = await client.auth.signInWithPassword({ email: farmer.email, password: farmer.password });
assert.ifError(authError);
try {
  // Invalid UUIDs can never mutate data. Missing RPCs fail before creating a fixture.
  for (const [name, args] of [
    ['prepare_lot_deletion', { lot_id: 'invalid-probe' }],
    ['delete_empty_lot', { lot_id: 'invalid-probe' }],
    ['replace_lot_image', { image_id: 'invalid-probe', new_path: 'invalid-probe' }],
  ]) {
    const { error } = await client.rpc(name, args);
    assert.equal(error?.code, '22P02', `${name}: expected installed RPC; received ${error?.code ?? 'no error'}. No lot created.`);
  }
  const lotId = randomUUID(); const owner = auth.user.id;
  const { data: fruit, error: catalogError } = await client.from('fruit_types').select('id').eq('active', true).limit(1).single();
  assert.ifError(catalogError);
  const { error: createError } = await client.from('lots').insert({ id: lotId, farmer_id: owner, fruit_type_id: fruit.id,
    title: `Deletion acceptance ${lotId}`, quantity_kg: 100, price_vnd_per_kg: 50000,
    harvest_start: '2026-11-01', harvest_end: '2026-11-02', province: 'Đồng Nai', status: 'DRAFT' });
  assert.ifError(createError);
  console.log(`Created disposable lot ${lotId}. If a check fails, this lot is retained for diagnosis.`);
  const bucket = client.storage.from('lot-images');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6Xl8AAAAASUVORK5CYII=', 'base64');
  const paths = ['linked', 'orphan'].map(name => `${owner}/${lotId}/${name}.png`);
  for (const path of paths) assert.ifError((await bucket.upload(path, png, { contentType: 'image/png', upsert: false })).error);
  assert.ifError((await client.from('lot_images').insert({ lot_id: lotId, storage_path: paths[0], sort_order: 0 })).error);
  assert.ifError((await client.rpc('prepare_lot_deletion', { lot_id: lotId })).error);
  const state = await client.from('lots').select('status').eq('id', lotId).single();
  assert.ifError(state.error); assert.equal(state.data.status, 'CLOSED');
  assert.equal((await client.rpc('delete_empty_lot', { lot_id: lotId })).error?.code, '23514');
  assert.ifError((await client.from('lot_images').delete().eq('lot_id', lotId)).error);
  assert.equal((await client.rpc('delete_empty_lot', { lot_id: lotId })).error?.code, '23514');
  assert.ifError((await bucket.remove(paths)).error);
  assert.ifError((await client.rpc('delete_empty_lot', { lot_id: lotId })).error);
  const remaining = await client.from('lots').select('id').eq('id', lotId);
  assert.ifError(remaining.error); assert.deepEqual(remaining.data, []);
  console.log('PASS live Supabase: installed RPCs, preparation, linked/orphan guards, Storage cleanup and final deletion.');
} finally { await client.auth.signOut(); }
