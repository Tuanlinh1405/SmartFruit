import { Link } from 'react-router-dom';
import content from './policy-content.html?raw';
import './policy.css';

export function PolicyPage() {
  return <div className="policy-page stack">
    <header><Link to="/role-home">Về không gian của bạn</Link><h1>Chính sách &amp; Bảo mật</h1><p>Cập nhật lần cuối: 22/10/2026</p></header>
    <p className="notice">Trạng thái tính năng: GPS/IoT, dự báo giá và matching theo khoảng cách chưa được cung cấp. Tìm xe hỗ trợ kết nối và báo giá trực tiếp; lịch xe do nhà xe xác nhận.</p>
    <nav aria-label="Mục lục chính sách">{['Bản chất nền tảng','Dữ liệu thu thập','Mục đích sử dụng','AI và bên thứ ba','Chia sẻ thông tin','Bảo mật','Quyền người dùng','Lưu trữ','Cookie','Trách nhiệm','Thay đổi chính sách','Liên hệ'].map((title,i)=><a key={title} href={`#policy-${i+1}`}>{String(i+1).padStart(2,'0')}. {title}</a>)}</nav>
    {/* Static, reviewed article extracted from the customer-supplied file. No user HTML. */}
    <div dangerouslySetInnerHTML={{ __html: content }} />
  </div>;
}
