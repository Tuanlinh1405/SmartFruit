import { useState } from 'react';
import { Siren } from 'lucide-react';
import { Modal } from '../../components/ui/dialog';

export function TripIncidentReport({ tripId, plate }: { tripId: string; plate: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('Sự cố phương tiện');
  const [description, setDescription] = useState('');
  const [reports, setReports] = useState<Record<string, { kind: string; description: string }>>({});
  const report = reports[tripId];
  return <section className="demo-incident">
    <button className="button demo-incident-trigger" onClick={() => { setKind('Sự cố phương tiện'); setDescription(''); setOpen(true); }}><Siren size={18} aria-hidden="true"/>Báo cáo sự cố chuyến đi</button>
    {report && <div className="demo-incident-result" role="status"><strong>Báo cáo mẫu · {report.kind}</strong><p>{report.description}</p><small>Chỉ lưu trong màn hình hiện tại; chưa gửi đến đối tác hoặc đội hỗ trợ.</small></div>}
    <Modal open={open} onOpenChange={setOpen} title="Báo cáo sự cố chuyến đi" description={`Chuyến mẫu ${plate}. Đây là thao tác minh họa, chưa gửi báo cáo thật.`}>
      <form className="demo-incident-form" onSubmit={event => {
        event.preventDefault();
        if (!description.trim()) return;
        setReports(previous => ({ ...previous, [tripId]: { kind, description: description.trim() } }));
        setOpen(false);
      }}>
        <label>Loại sự cố<select className="control" value={kind} onChange={event => setKind(event.target.value)}>{['Sự cố phương tiện', 'Giao thông / chậm giao hàng', 'Hàng hóa / nhiệt độ bảo quản', 'Sự cố khác'].map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Mô tả sự cố<textarea className="control" required maxLength={1000} rows={4} value={description} onChange={event => setDescription(event.target.value)} placeholder="Mô tả tình trạng và hỗ trợ cần thiết…"/></label>
        <div className="row"><button className="button button-secondary" type="button" onClick={() => setOpen(false)}>Hủy</button><button className="button demo-incident-trigger" type="submit" disabled={!description.trim()}>Ghi nhận báo cáo mẫu</button></div>
      </form>
    </Modal>
  </section>;
}
