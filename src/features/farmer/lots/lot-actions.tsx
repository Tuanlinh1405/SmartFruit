import { useRef, useState } from 'react';
import { Button, Modal } from '../../../components/ui';
import { canChangeStatus, type Lot, type LotStatus } from './lot.model';

function Action({ label, description, danger, onConfirm }: { label: string; description: string; danger?: boolean; onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const busy = useRef(false);
  async function confirm() {
    if (busy.current) return; busy.current = true; setSaving(true); setError('');
    try { await onConfirm(); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa thực hiện được. Vui lòng thử lại.'); }
    finally { busy.current = false; setSaving(false); }
  }
  return <Modal title={label} description={description} open={open} onOpenChange={next => { if (!busy.current) { setOpen(next); setError(''); } }}
    trigger={<Button variant={danger ? 'danger' : 'secondary'}>{label}</Button>}>
    <div className="row"><Button variant="secondary" disabled={saving} onClick={() => setOpen(false)}>Quay lại</Button><Button variant={danger ? 'danger' : 'primary'} loading={saving} onClick={() => { void confirm(); }}>Xác nhận</Button></div>
    {error && <p role="alert">{error}</p>}
  </Modal>;
}
export function LotActions({ lot, onStatus, onDelete }: { lot: Lot; onStatus: (status: LotStatus) => Promise<void>; onDelete: () => Promise<void> }) {
  return <div className="row">
    {([['PUBLISHED', 'Công bố lô'], ['CLOSED', 'Đóng lô'], ['CANCELLED', 'Hủy lô']] as const).filter(([status]) => canChangeStatus(lot.status, status)).map(([status, label]) =>
      <Action key={status} label={label} description={status === 'PUBLISHED' ? 'Nội dung lô sẽ được Buyer đọc. Thông tin riêng không công khai.' : 'Chỉ đổi trạng thái lô, không xác nhận giao dịch hoặc giao hàng.'} onConfirm={() => onStatus(status)} />)}
    <Action label="Xóa lô" description="Xóa vĩnh viễn lô, thông tin riêng và ảnh. Nếu dọn ảnh chưa hoàn tất, lô được giữ lại để thử lại." danger onConfirm={onDelete} />
  </div>;
}
