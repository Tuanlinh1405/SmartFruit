import { expect, test, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLotImagesRepository, validateLotPhoto, type LotImage, type LotImagesRepository } from './lot-images.api';
import { uploadQueuedPhotos } from './lot-images';
const u = '30000000-0000-4000-8000-000000000001'; const l = '40000000-0000-4000-8000-000000000001';
test('image file limits include empty, MIME and exact size boundary', () => {
  expect(() => validateLotPhoto(new File([], 'a.png', { type: 'image/png' }))).toThrow();
  expect(() => validateLotPhoto(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toThrow();
  expect(() => validateLotPhoto(new File([new Uint8Array(5242880)], 'a.png', { type: 'image/png' }))).not.toThrow();
  expect(() => validateLotPhoto(new File([new Uint8Array(5242881)], 'a.png', { type: 'image/png' }))).toThrow();
});
test('queued retry does not re-upload completed files and does not publish on partial failure', async () => {
  const files = [new File(['x'], '1.png'), new File(['y'], '2.png')]; const completed = new Set<File>();
  const upload = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
  const repository = { upload } as unknown as LotImagesRepository;
  await expect(uploadQueuedPhotos(repository, u, l, files, completed)).rejects.toThrow('network'); expect(completed.has(files[0])).toBe(true);
  await uploadQueuedPhotos(repository, u, l, files, completed); expect(upload).toHaveBeenCalledTimes(3); expect(upload.mock.calls[2][2]).toBe(files[1]);
});
function setup() {
  let rows: LotImage[] = []; const objects = new Set<string>(); let linkError = false; let removeError = false; let rpcError = false;
  const bucket = { upload: vi.fn(async (path: string) => { objects.add(path); return { error: null }; }),
    list: vi.fn(async () => ({ data: [...objects].map(name => ({ id: name, name: name.split('/').at(-1) })), error: null })),
    remove: vi.fn(async (paths: string[]) => { if (removeError) return { error: {} }; paths.forEach(p => objects.delete(p)); return { error: null }; }),
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'https://example.invalid/signed' }, error: null })),
  };
  const from = vi.fn((table: string) => {
    let op = 'read'; let payload: Record<string, unknown> = {}; let target = '';
    const done = async () => {
      if (table === 'lots') return { data: { id: l }, error: null };
      if (op === 'insert') { if (linkError) return { data: null, error: {} }; rows.push({ ...payload, id: crypto.randomUUID() } as unknown as LotImage); return { data: { id: 'new' }, error: null }; }
      if (op === 'delete') { rows = rows.filter(r => r.id !== target); return { data: { id: target }, error: null }; }
      return { data: rows, error: null };
    };
    const chain = { select: () => chain, eq: (key: string, value: string) => { if (key === 'id') target = value; return chain; }, order: () => chain,
      insert: (input: Record<string, unknown>) => { op = 'insert'; payload = input; return chain; }, delete: () => { op = 'delete'; return chain; }, single: done, maybeSingle: done,
      then: (resolve: (v: unknown) => unknown) => done().then(resolve),
    }; return chain;
  });
  const rpc = vi.fn(async (name: string, params: { image_id?: string; new_path?: string }) => {
    if (rpcError) return { error: {} };
    if (name === 'replace_lot_image') rows = rows.map(r => r.id === params.image_id ? { ...r, storage_path: params.new_path! } : r);
    return { error: null };
  });
  const getUser = vi.fn(async () => ({ data: { user: { id: u } }, error: null }));
  return { repo: createLotImagesRepository({ from, rpc, auth: { getUser }, storage: { from: () => bucket } } as unknown as SupabaseClient), bucket, rpc, from, getUser, objects,
    setRows(value: LotImage[]) { rows = value; }, rows: () => rows, failLink() { linkError = true; }, failRemove() { removeError = true; }, failRpc() { rpcError = true; } };
}
const file = () => new File(['image'], 'unsafe/name.png', { type: 'image/png' });
test('upload uses safe random folder path, non-overwrite, links then signs with TTL 60', async () => {
  const s = setup(); await s.repo.upload(u, l, file());
  expect(s.bucket.upload.mock.calls[0][0]).toMatch(new RegExp(`^${u}/${l}/[0-9a-f-]+\\.png$`));
  expect(s.rows()).toHaveLength(1); expect((await s.repo.list(u, l))[0].url).toContain('/signed');
  expect(s.bucket.createSignedUrl).toHaveBeenCalledWith(s.rows()[0].storage_path, 60);
});
test('eight slots block new image; replacement reuses slot and removes old object only after RPC', async () => {
  const s = setup(); const rows = Array.from({ length: 8 }, (_, n) => ({ id: `i${n}`, lot_id: l, storage_path: `${u}/${l}/old${n}.png`, sort_order: n })); s.setRows(rows); rows.forEach(r => s.objects.add(r.storage_path));
  await expect(s.repo.upload(u, l, file())).rejects.toThrow('tám ảnh');
  await s.repo.upload(u, l, file(), 'i0'); expect(s.rows()).toHaveLength(8); expect(s.rows()[0].sort_order).toBe(0); expect(s.objects.has(rows[0].storage_path)).toBe(false);
});
test('failed link cleans file, failed cleanup remains recoverable, and cannot delete linked objects', async () => {
  const s = setup(); s.failLink(); await expect(s.repo.upload(u, l, file())).rejects.toThrow('đã dọn'); expect(s.objects.size).toBe(0);
  s.failRemove(); await expect(s.repo.upload(u, l, file())).rejects.toThrow('chưa dọn'); expect(s.objects.size).toBe(1);
  const linked = setup(); await linked.repo.upload(u, l, file()); expect(await linked.repo.cleanup(u, l)).toBe(0); expect(linked.objects.size).toBe(1);
});
test('deleteLot unlinks and removes first, RPC fails closed and path/auth refuse before queries', async () => {
  const s = setup(); await s.repo.upload(u, l, file()); await s.repo.deleteLot(u, l); expect(s.rows()).toHaveLength(0); expect(s.objects.size).toBe(0); expect(s.rpc).toHaveBeenLastCalledWith('delete_empty_lot', { lot_id: l });
  s.failRpc(); await expect(s.repo.deleteLot(u, l)).rejects.toThrow('Chưa xóa lô');
  await expect(s.repo.cleanup(u, '../foreign')).rejects.toThrow('Định danh');
  await expect(s.repo.list('30000000-0000-4000-8000-000000000099', l)).rejects.toThrow('Phiên');
});
