import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTarget, resetTargetPassword, listTestAccounts } from './reset-auth-password.mjs';
const id = '99d27521-7c5c-436a-b34b-d92551fce935'; const email = 'buyer1@logstar.test';
function sdk(patch = {}) {
  const updates = []; const admin = { auth: { admin: {
    getUserById: async () => ({ data: { user: { id, email, app_metadata: { app_role: 'BUYER' } } }, error: null }),
    updateUserById: async (...args) => { updates.push(args); return { data: { user: { id, email } }, error: null }; }, ...patch,
  } } };
  return { admin, updates };
}
test('matching UID/email sends password only; never role or metadata', async () => {
  const { admin, updates } = sdk(); await resetTargetPassword(admin,id,email,'test-password-only');
  assert.deepEqual(updates, [[id, { password: 'test-password-only' }]]);
});
test('mismatched email, UID or missing user cannot update', async () => {
  for (const user of [{ id, email: 'other@example.test' }, { id: 'other', email }, null]) {
    const { admin, updates } = sdk({ getUserById: async () => ({ data: { user }, error: null }) });
    await assert.rejects(resetTargetPassword(admin,id,email,'test-password-only'), /không khớp/); assert.equal(updates.length,0);
  }
});
test('invalid input and short password cannot update', async () => {
  const { admin, updates } = sdk(); await assert.rejects(verifyTarget(admin,'bad',email));
  await assert.rejects(resetTargetPassword(admin,id,email,'short')); assert.equal(updates.length,0);
});
test('API errors are sanitized and cannot echo credentials', async () => {
  const { admin } = sdk({ updateUserById: async () => ({ data: { user: null }, error: { status: 422, message: 'DO-NOT-ECHO-SECRET' } }) });
  await assert.rejects(resetTargetPassword(admin,id,email,'test-password-only'), error => !error.message.includes('DO-NOT-ECHO-SECRET') && error.message.includes('422'));
});
test('six-character temporary password is accepted without changing metadata', async () => {
  const { admin, updates } = sdk();
  await resetTargetPassword(admin, id, email, 'abc123');
  assert.deepEqual(updates, [[id, { password: 'abc123' }]]);
});
test('bulk discovery reads all pages and only includes exact test domain', async () => {
  const pages = [];
  const { admin, updates } = sdk({ listUsers: async ({ page, perPage }) => {
    pages.push([page, perPage]);
    return { data: { users: page === 1 ? [
      { id, email }, { id: 'carrier', email: 'Carrier@LOGSTAR.TEST' },
      ...Array.from({ length: 98 }, (_, n) => ({ id: `outside-${n}`, email: n === 0 ? 'x@logstar.test.evil' : `x${n}@example.com` })),
    ] : [{ id: 'extra', email: 'farmer@logstar.test' }, { id: 'phone' }, { id: 'bad', email: 'x@y@logstar.test' }] }, error: null };
  } });
  const users = await listTestAccounts(admin);
  assert.deepEqual(users.map(user => user.id).sort(), [id, 'carrier', 'extra'].sort());
  assert.deepEqual(pages, [[1, 100], [2, 100]]);
  assert.equal(updates.length, 0);
});
test('failed discovery stops without any password updates or leaked API details', async () => {
  const { admin, updates } = sdk({ listUsers: async () => ({ data: null, error: { status: 403, message: 'SECRET' } }) });
  await assert.rejects(listTestAccounts(admin), error => error.message.includes('403') && !error.message.includes('SECRET'));
  assert.equal(updates.length, 0);
});
