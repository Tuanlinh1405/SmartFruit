import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, ErrorState, LoadingState, PhotoPlaceholder } from '../../../components/shared';
import { Button, TextField } from '../../../components/ui';
import { decodeLotPhoto, lotImagesRepository, type LotImagesRepository } from './lot-images.api';

export async function uploadQueuedPhotos(repository: LotImagesRepository, userId: string, lotId: string, files: File[], completed: Set<File>) {
  for (const file of files) {
    if (completed.has(file)) continue;
    await repository.upload(userId, lotId, file); completed.add(file);
  }
}
export function LotPhotoPicker({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const [error, setError] = useState(''); const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => { const next = files.map(file => URL.createObjectURL(file)); setUrls(next); return () => next.forEach(url => URL.revokeObjectURL(url)); }, [files]);
  return <Card title="Ảnh lô hàng"><div className="stack-sm"><TextField label="Chọn ảnh lô hàng" type="file" multiple disabled={disabled} accept="image/jpeg,image/png,image/webp" hint="Tối đa tám ảnh JPEG/PNG/WebP, 5 MiB mỗi ảnh. Ảnh được lưu sau khi có lô nháp."
    error={error || undefined} onChange={async event => {
      const input = event.currentTarget; const selected = Array.from(input.files ?? []); input.value = ''; setError('');
      try { if (selected.length > 8) throw new Error('Tối đa tám ảnh.'); for (const file of selected) await decodeLotPhoto(file); onChange(selected); }
      catch { setError('Không đọc được ảnh hoặc ảnh vượt giới hạn JPEG/PNG/WebP, 5 MiB, tám ảnh.'); }
    }} />
    <div className="role-grid">{urls.map((url, index) => <PhotoPlaceholder key={url} src={url} alt={files[index]?.name ?? 'Ảnh đã chọn'} />)}</div>
    {files.length > 0 && <Button variant="secondary" disabled={disabled} onClick={() => onChange([])}>Bỏ lựa chọn ảnh</Button>}
  </div></Card>;
}
export function LotImages({ userId, lotId, repository = lotImagesRepository }: { userId: string; lotId: string; repository?: LotImagesRepository }) {
  const images = useQuery({ queryKey: ['lot-images', userId, lotId], queryFn: () => repository.list(userId, lotId), retry: false, refetchInterval: 45_000 });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  async function action(work: () => Promise<unknown>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa xử lý được ảnh.'); }
    finally { await images.refetch(); lock.current = false; setBusy(false); }
  }
  return <Card title="Ảnh đã lưu"><div className="stack-sm">
    {images.isPending ? <LoadingState /> : images.isError ? <ErrorState message="Không thể tải ảnh." onRetry={() => { void images.refetch(); }} /> : <div className="role-grid">{images.data.map(image => <div className="stack-sm" key={image.id}>
      <PhotoPlaceholder src={image.url ?? undefined} alt={`Ảnh lô ${image.sort_order + 1}`} />
      {!image.url && <Button variant="secondary" onClick={() => { void images.refetch(); }}>Tải lại ảnh</Button>}
      <TextField label={`Thay ảnh ${image.sort_order + 1}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void action(async () => { await decodeLotPhoto(file); await repository.upload(userId, lotId, file, image.id); }); }} />
      <Button variant="danger" disabled={busy} onClick={() => { void action(() => repository.remove(userId, lotId, image)); }}>Xóa ảnh {image.sort_order + 1}</Button>
    </div>)}</div>}
    {images.data?.length === 0 && <p>Chưa có ảnh đã lưu.</p>}
    <TextField label="Thêm ảnh" type="file" disabled={busy || (images.data?.length ?? 8) >= 8} accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void action(async () => { await decodeLotPhoto(file); await repository.upload(userId, lotId, file); }); }} />
    <Button variant="secondary" loading={busy} onClick={() => { void action(() => repository.cleanup(userId, lotId)); }}>Dọn file chưa liên kết</Button>
    <p className="muted">Ảnh lỗi có thể tải lại. Chỉ dọn file chưa còn liên kết của lô này.</p>
    {error && <p role="alert">{error}</p>}
  </div></Card>;
}
