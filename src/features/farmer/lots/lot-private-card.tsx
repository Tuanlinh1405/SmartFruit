import { useRef, useState, type FormEvent } from 'react';
import { Card, ErrorState, LoadingState } from '../../../components/shared';
import { Button, TextArea, TextField } from '../../../components/ui';
import { useLotPrivate, useSaveLotPrivate } from './use-lots';
import { privateInput, type Lot, type LotPrivateInput, type LotPrivateRepository } from './lot.model';

export function LotPrivateCard({ userId, lot, repository }: { userId: string; lot: Lot; repository?: LotPrivateRepository }) {
  const query = useLotPrivate(userId, lot.id, repository);
  const save = useSaveLotPrivate(userId, lot.id, repository);
  return <Card title="Thông tin riêng của nhà vườn">
    <p className="muted">Giá sàn và ghi chú này không công khai cho Buyer. Lưu riêng với nội dung lô.</p>
    {query.isPending ? <LoadingState /> : query.isError ? <ErrorState message="Không thể tải thông tin riêng; chưa xác nhận được giá sàn." onRetry={() => { void query.refetch(); }} />
      : <PrivateForm key={`${userId}/${lot.id}`} initial={query.data} askingPrice={lot.price_vnd_per_kg} onSave={input => save.mutateAsync(input)} />}
  </Card>;
}
function PrivateForm({ initial, askingPrice, onSave }: { initial: LotPrivateInput | null; askingPrice: number; onSave: (input: LotPrivateInput) => Promise<unknown> }) {
  const [floor, setFloor] = useState(initial?.price_floor_vnd_per_kg == null ? '' : String(initial.price_floor_vnd_per_kg));
  const [notes, setNotes] = useState(initial?.internal_notes ?? '');
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false); const busy = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current) return;
    let input: LotPrivateInput;
    try { input = privateInput(floor, notes, askingPrice); }
    catch (error) { setMessage({ error: true, text: (error as Error).message }); return; }
    busy.current = true; setSaving(true); setMessage(null);
    try { await onSave(input); setMessage({ error: false, text: 'Đã lưu thông tin riêng.' }); }
    catch { setMessage({ error: true, text: 'Chưa lưu được thông tin riêng. Nội dung lô không bị thay đổi. Tải lại giá chào nếu dữ liệu đã thay đổi.' }); }
    finally { busy.current = false; setSaving(false); }
  }
  return <form className="stack-sm" aria-label="Thông tin riêng" noValidate onSubmit={submit}>
    <TextField label="Giá sàn riêng (đ/kg)" hint="Để trống nếu không có giá sàn." value={floor} disabled={saving} onChange={event => { setFloor(event.target.value); setMessage(null); }} />
    <TextArea label="Ghi chú nội bộ" value={notes} disabled={saving} onChange={event => { setNotes(event.target.value); setMessage(null); }} />
    <div><Button type="submit" variant="secondary" loading={saving}>Lưu thông tin riêng</Button></div>
    {message && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
  </form>;
}
