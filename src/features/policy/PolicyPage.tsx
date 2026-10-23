import { Link } from 'react-router-dom';
import content from './policy-content.html?raw';
import './policy.css';

export function PolicyPage() {
  return <div className="policy-page stack">
    <header><Link to="/role-home">Về không gian của bạn</Link><h1>Chính sách &amp; Bảo mật</h1><p>Cập nhật lần cuối: 22/10/2026</p></header>
    <nav aria-label="Mục lục chính sách">{['Bản chất nền tảng','Dữ liệu thu thập','Mục đích sử dụng','AI và bên thứ ba','Chia sẻ thông tin','Bảo mật','Quyền người dùng','Lưu trữ','Cookie','Trách nhiệm','Thay đổi chính sách','Liên hệ'].map((title,i)=><a key={title} href={`#policy-${i+1}`}>{String(i+1).padStart(2,'0')}. {title}</a>)}</nav>
    {/* Static, reviewed article extracted from the customer-supplied file. No user HTML. */}
    <div dangerouslySetInnerHTML={{ __html: content }} />
    <footer className="policy-footer">© 2026 OnlMallFruit · Nền tảng kết nối chuỗi cung ứng trái cây thông minh · B2B Agritech Vietnam</footer>
  </div>;
}
