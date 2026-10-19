import { supabase } from '../../../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
export interface LotImage { id: string; lot_id: string; storage_path: string; sort_order: number; }
export interface SignedImage extends LotImage { url: string | null; expiresAt: number; }
export interface LotImagesRepository {
  list(userId: string, lotId: string): Promise<SignedImage[]>;
  upload(userId: string, lotId: string, file: File, replaceId?: string): Promise<void>;
  remove(userId: string, lotId: string, image: LotImage): Promise<void>;
  cleanup(userId: string, lotId: string): Promise<number>;
  deleteLot(userId: string, lotId: string): Promise<void>;
}
const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export function lotDeletionError(cause: { code?: string; message?: string }): Error {
  const message = cause.code === 'PGRST202' || cause.code === '42883'
    ? 'Máy chủ chưa cập nhật chức năng xóa lô. Vui lòng liên hệ quản trị viên; chưa thể xóa lô.'
    : cause.code === '23503'
      ? 'Lô đã có lịch sử kết nối; hãy đóng lô để giữ lịch sử.'
      : cause.code === '42501'
        ? 'Bạn không có quyền xóa lô hoặc phiên đăng nhập đã hết hạn.'
        : cause.code === '23514'
          ? 'Lô chưa xóa vì còn file ảnh hoặc có ảnh đang tải lên. Lô được giữ lại; hãy tải lại và thử tiếp.'
          : 'Chưa xác nhận được việc xóa lô. Hãy kiểm tra kết nối mạng, tải lại và thử tiếp.';
  return Object.assign(new Error(message, { cause }), { code: cause.code });
}
export function validateLotPhoto(file: File): void {
  if (!extensions[file.type] || file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('Chọn ảnh JPEG/PNG/WebP, dung lượng lớn hơn 0 và tối đa 5 MiB.');
}
export async function decodeLotPhoto(file: File): Promise<void> {
  validateLotPhoto(file);
  const bitmap = await createImageBitmap(file);
  try { if (!bitmap.width || !bitmap.height) throw new Error('Ảnh không đọc được.'); }
  finally { bitmap.close(); }
}
export function createLotImagesRepository(client: SupabaseClient): LotImagesRepository {
  const bucket = client.storage.from('lot-images');
  const folder = (userId: string, lotId: string) => {
    if (![userId, lotId].every(id => /^[0-9a-f-]{36}$/.test(id))) throw new Error('Định danh lô không hợp lệ.');
    return `${userId}/${lotId}`;
  };
  async function owner(userId: string, lotId: string) {
    folder(userId, lotId);
    const auth = await client.auth.getUser();
    if (auth.error || auth.data.user?.id !== userId) throw new Error('Phiên đăng nhập không hợp lệ.');
    const lot = await client.from('lots').select('id').eq('id', lotId).eq('farmer_id', userId).maybeSingle();
    if (lot.error || !lot.data) throw new Error('Không truy cập được lô hàng.');
  }
  async function links(lotId: string): Promise<LotImage[]> {
    const result = await client.from('lot_images').select('id,lot_id,storage_path,sort_order').eq('lot_id', lotId).order('sort_order');
    if (result.error || !result.data) throw new Error('Không thể tải liên kết ảnh.');
    return result.data;
  }
  async function objects(userId: string, lotId: string): Promise<string[]> {
    const prefix = folder(userId, lotId); const paths: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const result = await bucket.list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
      if (result.error || !result.data) throw new Error('Không kiểm tra được file ảnh. Lô chưa bị xóa.');
      for (const item of result.data) {
        if (!item.id || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}\.(jpg|jpeg|png|webp)$/.test(item.name)) throw new Error('Folder có nội dung không được hỗ trợ; chưa dọn file.');
        paths.push(`${prefix}/${item.name}`);
      }
      if (result.data.length < 100) return paths;
    }
  }
  async function removeObject(userId: string, lotId: string, path: string) {
    if (!path.startsWith(`${folder(userId, lotId)}/`) || path.split('/').length !== 3) throw new Error('Đường dẫn ảnh không hợp lệ.');
    if ((await links(lotId)).some(image => image.storage_path === path)) throw new Error('Ảnh vẫn được liên kết; chưa xóa file.');
    const result = await bucket.remove([path]);
    if (result.error) throw new Error('Đã đổi liên kết nhưng chưa dọn được file. Hãy thử Dọn file chưa liên kết.');
    if ((await objects(userId, lotId)).includes(path)) throw new Error('File chưa được xóa. Vui lòng thử dọn lại.');
  }
  const repository: LotImagesRepository = {
    async list(userId, lotId) {
      await owner(userId, lotId);
      return Promise.all((await links(lotId)).map(async image => {
        const signed = await bucket.createSignedUrl(image.storage_path, 60);
        return { ...image, url: signed.error ? null : signed.data?.signedUrl ?? null, expiresAt: Date.now() + 60_000 };
      }));
    },
    async upload(userId, lotId, file, replaceId) {
      await owner(userId, lotId); validateLotPhoto(file);
      const current = await links(lotId); const replacing = replaceId ? current.find(item => item.id === replaceId) : undefined;
      if (replaceId && !replacing) throw new Error('Ảnh cần thay không còn tồn tại.');
      const slot = Array.from({ length: 8 }, (_, index) => index).find(index => !current.some(item => item.sort_order === index));
      if (!replacing && slot === undefined) throw new Error('Mỗi lô tối đa tám ảnh.');
      const path = `${folder(userId, lotId)}/${crypto.randomUUID()}.${extensions[file.type]}`;
      const uploaded = await bucket.upload(path, file, { upsert: false, contentType: file.type });
      if (uploaded.error) throw new Error('Chưa tải được ảnh. Dọn file chưa liên kết trước khi thử lại nếu mạng bị gián đoạn.');
      const linked = replacing ? await client.rpc('replace_lot_image', { image_id: replacing.id, new_path: path })
        : await client.from('lot_images').insert({ lot_id: lotId, storage_path: path, sort_order: slot }).select('id').single();
      if (linked.error) {
        // A timed-out request may already have committed. Never delete a linked object.
        const after = await links(lotId);
        if (!after.some(item => item.storage_path === path)) await removeObject(userId, lotId, path);
        else { if (replacing) await removeObject(userId, lotId, replacing.storage_path); return; }
        throw new Error('Ảnh chưa được liên kết; đã dọn file mới. Vui lòng thử lại.');
      }
      if (replacing) await removeObject(userId, lotId, replacing.storage_path);
    },
    async remove(userId, lotId, image) {
      await owner(userId, lotId);
      const current = (await links(lotId)).find(item => item.id === image.id);
      if (current && current.storage_path !== image.storage_path) throw new Error('Ảnh đã được thay đổi. Vui lòng tải lại.');
      if (current) {
        const result = await client.from('lot_images').delete().eq('id', image.id).eq('lot_id', lotId).eq('storage_path', image.storage_path).select('id').single();
        if (result.error || !result.data) throw new Error('Chưa bỏ được liên kết ảnh. Vui lòng tải lại.');
      }
      await removeObject(userId, lotId, image.storage_path);
    },
    async cleanup(userId, lotId) {
      await owner(userId, lotId); let count = 0;
      for (const path of await objects(userId, lotId)) {
        if (!(await links(lotId)).some(image => image.storage_path === path)) { await removeObject(userId, lotId, path); count++; }
      }
      return count;
    },
    async deleteLot(userId, lotId) {
      await owner(userId, lotId);
      // Fail before touching photos when the backend is unavailable or history must be retained.
      const prepared = await client.rpc('prepare_lot_deletion', { lot_id: lotId });
      if (prepared.error) throw lotDeletionError(prepared.error);
      for (const image of await links(lotId)) await repository.remove(userId, lotId, image);
      await repository.cleanup(userId, lotId);
      const result = await client.rpc('delete_empty_lot', { lot_id: lotId });
      if (result.error) throw lotDeletionError(result.error);
    },
  };
  return repository;
}
async function configured() { return createLotImagesRepository(supabase); }
export const lotImagesRepository: LotImagesRepository = {
  list: async (u, l) => (await configured()).list(u, l), upload: async (u, l, f, r) => (await configured()).upload(u, l, f, r),
  remove: async (u, l, i) => (await configured()).remove(u, l, i), cleanup: async (u, l) => (await configured()).cleanup(u, l),
  deleteLot: async (u, l) => (await configured()).deleteLot(u, l),
};
