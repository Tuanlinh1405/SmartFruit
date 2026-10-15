import type { SupabaseClient } from '@supabase/supabase-js';
import { expect, test, vi } from 'vitest';
import { createFarmerProfileRepository } from './farmer-profile.api';
import { parseProfileForm, profileToForm } from './farmer-profile.model';

const input = () => parseProfileForm({ ...profileToForm(), farm_name: 'Ri6', province: 'Tiền Giang' }).data!;
function setup() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const single = vi.fn().mockResolvedValue({ data: { ...input(), user_id: 'farmer-1' }, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn((_columns: string) => ({ eq }));
  const upsertSelect = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select: upsertSelect }));
  const from = vi.fn(() => ({ select, upsert }));
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'farmer-1' } }, error: null });
  const repository = createFarmerProfileRepository({ auth: { getUser }, from } as unknown as SupabaseClient);
  return { repository, from, select, eq, maybeSingle, upsert, single, getUser };
}

test('load uses verified identity and explicit columns; missing profile returns null', async () => {
  const s = setup();
  await expect(s.repository.load('farmer-1')).resolves.toBeNull();
  expect(s.from).toHaveBeenCalledWith('farmer_profiles');
  expect(s.eq).toHaveBeenCalledWith('user_id', 'farmer-1');
  expect(s.select.mock.calls[0]?.[0]).not.toBe('*');
  const row = { ...input(), user_id: 'farmer-1' };
  s.maybeSingle.mockResolvedValueOnce({ data: row, error: null });
  await expect(s.repository.load('farmer-1')).resolves.toEqual(row);
});

test('save whitelists fields and sets owner from verified Auth, never from input', async () => {
  const s = setup();
  await s.repository.save('farmer-1', { ...input(), user_id: 'attacker', profile_role: 'ADMIN', role: 'ADMIN', created_at: 'bad', updated_at: 'bad' } as ReturnType<typeof input>);
  expect(s.upsert).toHaveBeenCalledWith({ ...input(), user_id: 'farmer-1' }, { onConflict: 'user_id' });
});

test.each(['load', 'save'] as const)('%s refuses missing/foreign/expired Auth before querying DB', async operation => {
  for (const response of [
    { data: { user: null }, error: null },
    { data: { user: { id: 'other-user' } }, error: null },
    { data: { user: { id: 'farmer-1' } }, error: { message: 'expired secret' } },
  ]) {
    const s = setup(); s.getUser.mockResolvedValue(response);
    await expect(operation === 'load' ? s.repository.load('farmer-1') : s.repository.save('farmer-1', input())).rejects.toThrow('Phiên đăng nhập không hợp lệ');
    expect(s.from).not.toHaveBeenCalled();
  }
});

test('invalid save is refused and DB errors do not leak raw messages', async () => {
  const s = setup();
  await expect(s.repository.save('farmer-1', { ...input(), farm_name: '' })).rejects.toThrow('chưa hợp lệ');
  expect(s.upsert).not.toHaveBeenCalled();
  s.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'internal detail' } });
  await expect(s.repository.load('farmer-1')).rejects.toThrow('Không thể tải hồ sơ');
  s.single.mockResolvedValueOnce({ data: null, error: { message: 'internal detail' } });
  await expect(s.repository.save('farmer-1', input())).rejects.toThrow('Không thể lưu hồ sơ');
});
