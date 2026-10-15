import { Link } from 'react-router-dom';
import type { UiEntry } from '../types/ui';
import { uiInventory } from './ui-inventory';
import { Card, DemoNotice, PageHeader } from '../components/shared/content';
export function SkeletonPage({ entry }: { entry: UiEntry }) {
  const modals = uiInventory.filter(item => item.kind === 'modal' && item.path === entry.path);
  return <div className="stack"><PageHeader eyebrow={`${entry.id} · Skeleton`} title={entry.title} description="Khung trang dùng chung đã sẵn sàng. Nội dung nghiệp vụ chưa triển khai." /><DemoNotice>Đây là giao diện nền. Chưa đọc/ghi dữ liệu, xác thực hoặc thực hiện giao dịch.</DemoNotice><Card><div className="row"><span className="badge">Owner {entry.owner}</span><span className="badge">Mức dự kiến: {entry.level}</span></div><div className="skeleton-body"><h2>Vùng nội dung feature</h2><p className="muted">Developer sẽ điền nội dung bằng UI kit chung ở giai đoạn tiếp theo.</p><div className="skeleton-line" /><div className="skeleton-line" style={{ width:'55%' }} /></div></Card>{modals.length > 0 && <Card title="Modal thuộc trang này"><ul>{modals.map(item => <li key={item.id}>{item.id} — {item.title} <span className="muted">· Chưa triển khai</span></li>)}</ul></Card>}{!entry.role && <Link to="/">Quay lại chọn khu vực</Link>}</div>;
}
export function StatusPage({ code }: { code: '403' | '404' }) { return <main className="auth-layout stack"><PageHeader eyebrow={`AUTH-04 · ${code}`} title={code === '403' ? 'Không có quyền truy cập' : 'Không tìm thấy trang'} description={code === '403' ? 'Trang thông báo mẫu; chưa kết nối kiểm tra quyền thật.' : 'Địa chỉ này chưa có trong ứng dụng.'} /><Link to="/" className="button button-secondary">Quay lại trang đầu</Link></main>; }
