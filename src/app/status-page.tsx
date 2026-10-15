import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../components/shared/content';
export function StatusPage({code}:{code:'403'|'404'}) {
  return <main className="auth-layout stack"><PageHeader eyebrow={`AUTH-04 · ${code}`}
    title={code==='403'?'Không có quyền truy cập':'Không tìm thấy trang'}
    description={code==='403'?'Vai trò của tài khoản không được mở khu vực này.':'Địa chỉ này chưa có trong ứng dụng.'} />
    <Card><Link className="button button-secondary" to="/">Về trang chính</Link></Card></main>;
}
