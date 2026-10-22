import { Link, Navigate } from 'react-router-dom';
import { ArrowDown, ArrowRight, Check, ClipboardList, Handshake, ShoppingBasket, Sprout, Truck } from 'lucide-react';
import { Brand } from '../components/shared/brand';
import { useAuth } from '../features/auth/AuthProvider';
import { roleHome } from '../features/auth/auth-routing';
import './start-page.css';

const roles = [
  { icon: Sprout, name: 'Nhà vườn', label: 'Từ nông sản của bạn', description: 'Đăng lô hàng, tìm nhu cầu thu mua phù hợp và trao đổi trực tiếp với đối tác.', features: ['Quản lý lô nông sản', 'Kết nối người thu mua'] },
  { icon: ShoppingBasket, name: 'Thu mua', label: 'Đến nguồn hàng phù hợp', description: 'Đăng nhu cầu, khám phá lô hàng và theo dõi các trao đổi trong cùng một nơi.', features: ['Đăng nhu cầu thu mua', 'Tìm và kết nối nhà vườn'] },
  { icon: Truck, name: 'Vận tải', label: 'Kết nối hành trình', description: 'Quản lý đội xe, cập nhật khả năng vận chuyển và trao đổi về nhu cầu giao nhận.', features: ['Quản lý thông tin xe', 'Trao đổi yêu cầu vận chuyển'] },
];

export function StartPage() {
  const { status, profile } = useAuth();
  if (status === 'ready' && profile?.role) return <Navigate to={roleHome(profile.role)} replace />;
  return <div className="start-page">
    <header className="start-header">
      <div className="start-container start-header-inner">
        <Link to="/" className="brand" aria-label="onlmallfruit — Trang chủ"><Brand /></Link>
        <nav aria-label="Điều hướng giới thiệu">
          <a className="start-nav-link" href="#vai-tro">Dành cho ai</a>
          <a className="start-nav-link" href="#cach-hoat-dong">Cách hoạt động</a>
          <Link className="button start-login" to="/login">Đăng nhập <ArrowRight size={16} aria-hidden="true" /></Link>
        </nav>
      </div>
    </header>

    <main className="start-container">
      <section className="start-hero" aria-labelledby="start-title">
        <div className="start-intro">
          <span className="start-kicker"><span /> Kết nối nông sản Việt Nam</span>
          <h1 id="start-title">Nhà vườn, thu mua<br /> và <span>vận tải</span></h1>
          <p className="start-lead">Cùng kết nối.<br /> Để nông sản đi xa hơn.</p>
          <p className="start-description">Từ lô nông sản đến nhu cầu thu mua và vận chuyển. Tìm đối tác, trao đổi và quản lý công việc trong một không gian chung.</p>
          <div className="start-actions">
            <Link className="button button-primary" to="/register">Tạo tài khoản <ArrowRight size={16} aria-hidden="true" /></Link>
            <a className="start-text-link" href="#cach-hoat-dong">Khám phá cách hoạt động <ArrowDown size={15} aria-hidden="true" /></a>
          </div>
          <p className="start-note"><Check size={14} aria-hidden="true" /> Chọn vai trò phù hợp khi đăng ký</p>
        </div>

        <div className="start-network" aria-label="Kết nối nhà vườn, thu mua và vận tải">
          <div className="start-network-heading"><span className="start-network-mark"><Sprout size={18} aria-hidden="true" /></span><div><strong>Một nền tảng. Ba vai trò.</strong><p>Liền mạch từ nguồn hàng đến vận chuyển</p></div></div>
          <div className="start-network-body">
            {roles.map(({ icon: Icon, name, label }, index) => <div className="start-network-node" key={name}>
              <span className="start-role-icon"><Icon size={21} strokeWidth={1.7} aria-hidden="true" /></span>
              <div><small>{label}</small><strong>{name}</strong></div>
              <span className="start-node-number">0{index + 1}</span>
            </div>)}
          </div>
          <div className="start-network-footer"><Handshake size={17} aria-hidden="true" /><span>Tìm đối tác · Trao đổi · Thỏa thuận</span></div>
        </div>
      </section>

      <section id="vai-tro" className="start-section" aria-labelledby="start-roles-title">
        <div className="start-section-heading"><div><p className="start-section-label">DÀNH CHO AI</p><h2 id="start-roles-title">Mỗi vai trò, một không gian làm việc</h2></div><p>Đúng công cụ cho công việc của bạn.</p></div>
        <div className="start-role-grid">{roles.map(({ icon: Icon, name, description, features }) => <article className="start-role-card" key={name}>
          <span className="start-role-icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
          <h3>{name}</h3><p>{description}</p>
          <ul>{features.map(feature => <li key={feature}><Check size={14} aria-hidden="true" />{feature}</li>)}</ul>
        </article>)}</div>
      </section>

      <section id="cach-hoat-dong" className="start-section start-process" aria-labelledby="start-process-title">
        <div className="start-section-heading"><div><p className="start-section-label">CÁCH HOẠT ĐỘNG</p><h2 id="start-process-title">Bắt đầu từ một kết nối</h2></div></div>
        <ol className="start-steps">
          <li><span>01</span><div><h3>Tạo hồ sơ</h3><p>Đăng ký vai trò và cập nhật thông tin để đối tác hiểu bạn.</p></div></li>
          <li><span>02</span><div><h3>Đăng thông tin, tìm đối tác</h3><p>Thêm lô hàng, nhu cầu thu mua hoặc thông tin đội xe.</p></div></li>
          <li><span>03</span><div><h3>Trao đổi và thỏa thuận</h3><p>Kết nối trực tiếp, làm rõ nhu cầu và thống nhất cùng đối tác.</p></div></li>
        </ol>
        <div className="start-process-cta"><div><ClipboardList size={20} aria-hidden="true" /><p>Sẵn sàng cho kết nối đầu tiên?</p></div><Link className="button button-primary" to="/register">Đăng ký <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </section>
    </main>

    <footer className="start-container start-footer"><p>onlmallfruit <span>· Kết nối nông sản Việt Nam</span></p><div><Link to="/policy">Chính sách nền tảng</Link>{import.meta.env.DEV && <Link to="/dev/ui">UI kit</Link>}</div></footer>
  </div>;
}
