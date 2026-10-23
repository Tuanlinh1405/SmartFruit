import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Bell, Bot, Brain, Check, Handshake, Home, Mail, Phone, Puzzle, Satellite, Scissors, Settings, ShieldCheck, Sparkles, Sprout, Star, ThumbsUp, TrendingDown, Truck } from 'lucide-react';
import { Brand } from '../components/shared/brand';
import { useAuth } from '../features/auth/AuthProvider';
import { roleHome } from '../features/auth/auth-routing';
import './start-page.css';

const navigation = [
  { id: 'trang-chu', label: 'Trang chủ', icon: Home },
  { id: 'tai-sao-chon', label: 'Tại sao chọn', icon: Sparkles },
  { id: 'he-sinh-thai', label: 'Hệ sinh thái', icon: Puzzle },
  { id: 'cong-nghe', label: 'Công nghệ', icon: Settings },
];
const benefits = [
  { icon: TrendingDown, tone: 'green', title: 'Hết “được mùa, mất giá”', description: 'Không còn bị động chờ vài thương lái quen. Mở rộng mạng lưới mua bán, nắm quyền chủ động về giá và đầu ra.' },
  { icon: Scissors, tone: 'gold', title: 'Cắt khâu trung gian', description: 'Kết nối trực tiếp người có trái cây và người cần mua, tối ưu lợi nhuận cho cả hai phía.' },
  { icon: Truck, tone: 'blue', title: 'Vận tải uy tín, đúng “giờ vàng”', description: 'Tìm xe phù hợp ngay trên nền tảng, chủ động trao đổi lịch giao nhận để rút ngắn thời gian sau thu hoạch.' },
];
const roles = [
  { icon: Sprout, tone: 'green', title: 'Nhà vườn / Nông dân', subtitle: 'Bán đúng giá, chủ động đầu ra', features: [
    ['AI Trợ lý Giá', 'Khám phá dự báo giá minh họa và tham khảo xu hướng thị trường.'],
    ['Tự tìm đầu ra', 'Đăng lô hàng, nhận gợi ý người mua đang có nhu cầu phù hợp.'],
    ['Quản lý rủi ro', 'Theo dõi thời tiết để chủ động mùa vụ và lịch thu hoạch.'],
  ] },
  { icon: Handshake, tone: 'gold', title: 'Thương lái / DN thu mua', subtitle: 'Gom hàng nhanh, đúng tiêu chuẩn', features: [
    ['Lọc nguồn cung chính xác', 'Tìm theo tên nông sản, số lượng và giá cần mua.'],
    ['Giám sát chuỗi lạnh', 'Khám phá giao diện tracking và cảm biến trong bản mô phỏng.'],
    ['Đàm phán dễ dàng', 'Chat và gửi đề nghị để thống nhất điều kiện với nhà vườn.'],
  ] },
  { icon: Truck, tone: 'blue', title: 'Đơn vị vận chuyển', subtitle: 'Nhận cước liên tục, tối ưu lộ trình', features: [
    ['Nhận yêu cầu vận chuyển', 'Kết nối nhu cầu giao nhận từ nhà vườn và thương lái.'],
    ['Tối ưu lộ trình', 'Xem tuyến xe, ETA và cảm biến trong bản mô phỏng hành trình.'],
    ['Xây dựng uy tín', 'Khám phá giao diện đánh giá tài xế, hiện dùng dữ liệu mẫu.'],
  ] },
];
const technology = [
  { icon: Brain, title: 'Matching thông minh', description: 'Gợi ý đối tác theo mức độ phù hợp về tên nông sản, giá và sản lượng, giúp bạn tìm đúng nhu cầu.' },
  { icon: Bot, title: 'AI cố vấn đàm phán & thị trường', description: 'Trợ lý hỗ trợ tra cứu thông tin nông sản và giải đáp các tình huống giao dịch ngay trên nền tảng.' },
  { icon: Star, title: 'Đánh giá tín nhiệm minh bạch', description: 'Chấm điểm từ 1–5 sao sau khi hai bên hoàn tất giao dịch, cùng xây dựng mạng lưới đối tác đáng tin cậy.' },
];

function OrchardIllustration() {
  return <div className="start-orchard" role="group" aria-label="Minh họa kết nối nông sản, matching và vận chuyển">
    <svg className="start-landscape" viewBox="0 0 560 620" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Vườn trái cây xanh và xe vận chuyển trên đường">
      <defs><linearGradient id="orchard-sky" x2="0" y2="1"><stop stopColor="#c3ead8"/><stop offset="1" stopColor="#e0f4e9"/></linearGradient><linearGradient id="orchard-ground" x2="1" y2="1"><stop stopColor="#38b878"/><stop offset="1" stopColor="#12a15a"/></linearGradient></defs>
      <rect width="560" height="620" fill="url(#orchard-sky)"/>
      <circle cx="450" cy="90" r="59" fill="#f4fcf7" opacity=".75"/>
      <path d="M0 298C110 243 197 280 302 252S453 233 560 249V620H0Z" fill="#78c49d"/>
      <path d="M0 358C127 320 209 364 335 328S474 327 560 316V620H0Z" fill="url(#orchard-ground)"/>
      {[{x:76,y:334,s:1},{x:177,y:365,s:1.12},{x:289,y:350,s:1.02}].map(({x,y,s})=><g key={x} transform={`translate(${x} ${y}) scale(${s})`}><ellipse cy="39" rx="37" ry="9" fill="#127344" opacity=".18"/><circle cy="-6" r="29" fill="#16814b"/><circle cx="-16" cy="12" r="22" fill="#1a9555"/><circle cx="15" cy="12" r="23" fill="#087741"/><rect x="-5" y="21" width="10" height="30" rx="4" fill="#976a31"/></g>)}
      <text x="378" y="295" fontSize="35">🥭</text><text x="472" y="391" fontSize="29">🍈</text><text x="133" y="228" fontSize="24">🌱</text>
      <path d="M-38 597C93 560 147 497 263 472S449 440 596 439" fill="none" stroke="#dedec5" strokeWidth="65"/>
      <path d="M-38 597C93 560 147 497 263 472S449 440 596 439" fill="none" stroke="#fffdf1" strokeWidth="4" strokeDasharray="17 15"/>
      <g transform="translate(194 450) rotate(-13)"><rect width="48" height="33" rx="5" fill="white"/><text x="10" y="24" fontSize="23">🥭</text><path d="M48 9h18l9 11v15H48Z" fill="#21b265"/><path d="M54 13h10l6 10H54Z" fill="#b7e8dc"/><circle cx="13" cy="36" r="8" fill="#31483a"/><circle cx="61" cy="36" r="8" fill="#31483a"/><circle cx="13" cy="36" r="3" fill="#e5e8df"/><circle cx="61" cy="36" r="3" fill="#e5e8df"/></g>
    </svg>
    <div className="start-float start-price-card">
      <div className="start-mini-heading"><span className="start-mini-icon green"><Bot size={20}/></span><div><strong>AI Trợ lý Giá</strong><small>Sầu riêng Ri6 · Giá minh họa</small></div></div>
      <div className="start-price-value">85.000đ <span>▲ 8,2%</span></div>
      <svg viewBox="0 0 200 45" aria-hidden="true"><defs><linearGradient id="price-sample-fill" x2="0" y2="1"><stop stopColor="#a9e5c1"/><stop offset="1" stopColor="#fff"/></linearGradient></defs><path d="M0 37 40 32 79 28 118 20 160 15 200 10V45H0Z" fill="url(#price-sample-fill)"/><path d="M0 37 40 32 79 28 118 20 160 15 200 10" fill="none" stroke="#18ac5c" strokeWidth="2.5"/></svg>
    </div>
    <div className="start-float start-match-card"><div className="start-mini-heading"><span className="start-mini-icon gold"><Puzzle size={20}/></span><div><strong>Khớp lệnh</strong><small>Matching AI · Minh họa</small></div></div><div className="start-match-row"><span>👨‍🌾</span><span>Nhà vườn<br/>Minh Út</span><strong>92%</strong></div><div className="start-match-row"><span>🤝</span><span>Thương lái<br/>Hậu</span><strong>88%</strong></div></div>
    <div className="start-float start-rating-card"><strong><Star size={23} fill="currentColor"/> 4.9</strong><small>Tín nhiệm minh họa</small></div>
    <div className="start-float start-tracking-card"><div className="start-mini-heading"><span className="start-mini-icon blue"><Satellite size={21}/></span><div><strong>Live Tracking</strong><small>ETA 16:30 · còn 42 km · Mô phỏng</small></div></div><p>❄️ Nhiệt độ cont: <strong>4.5°C · An toàn</strong></p><p>🚚 Lộ trình đa phương thức · đúng giờ</p></div>
  </div>;
}

export function StartPage() {
  const { status, profile } = useAuth();
  const [activeSection, setActiveSection] = useState(() => window.location.hash.slice(1) || 'trang-chu');
  useEffect(() => {
    const update = () => setActiveSection(window.location.hash.slice(1) || 'trang-chu');
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  if (status === 'ready' && profile?.role) return <Navigate to={roleHome(profile.role)} replace />;
  return <div className="start-page" id="trang-chu">
    <a className="start-skip-link" href="#start-main">Đến nội dung chính</a>
    <header className="start-header"><div className="start-container start-header-inner">
      <a className="start-logo" href="#trang-chu" aria-label="onlmallfruit — Trang chủ"><Brand/></a>
      <nav aria-label="Điều hướng giới thiệu">{navigation.map(({id,label,icon:Icon})=><a key={id} href={`#${id}`} aria-current={activeSection===id?'location':undefined} onClick={()=>setActiveSection(id)}><Icon size={16} aria-hidden="true"/>{label}</a>)}</nav>
      <div className="start-header-actions"><Link className="start-guest-bell" to="/login" aria-label="Đăng nhập để xem thông báo"><Bell size={20}/></Link><Link className="start-login" to="/login">Đăng nhập</Link></div>
    </div></header>
    <main id="start-main" className="start-container">
      <section className="start-hero" aria-labelledby="start-title"><div className="start-intro">
        <span className="start-kicker"><Sprout size={15} aria-hidden="true"/> Nền tảng kết nối chuỗi cung ứng trái cây thông minh</span>
        <h1 id="start-title">Thuận mua. <br/>Vừa bán. <br/><span>Vận chuyển</span> <em>tối ưu.</em></h1>
        <p className="start-description">Mở gian hàng nông sản của bạn — <strong>miễn phí.</strong> Giải pháp công nghệ giúp nhà vườn, thương lái và đơn vị vận chuyển tìm thấy nhau trực tiếp.</p>
        <div className="start-stats" aria-label="Quy mô minh họa"><div><strong>2.400+</strong><span>Nhà vườn</span></div><div><strong>850+</strong><span>Thương lái</span></div><div><strong>31</strong><span>Tỉnh thành phủ sóng</span></div></div><p className="start-sample-note">Số liệu quy mô và thẻ thông tin bên cạnh là minh họa.</p>
        <div className="start-actions"><Link className="start-primary" to="/register">Đăng ký tài khoản ngay <ArrowRight size={18} aria-hidden="true"/></Link><a className="start-secondary" href="#tai-sao-chon">Tìm hiểu thêm</a></div>
        <ul className="start-trust"><li><ThumbsUp size={17} aria-hidden="true"/>Dễ sử dụng</li><li><ShieldCheck size={17} aria-hidden="true"/>Bảo mật dữ liệu</li><li><Handshake size={17} aria-hidden="true"/>Đồng hành cùng nhà nông</li></ul>
      </div><OrchardIllustration/></section>

      <section className="start-mission" aria-label="Mục tiêu nền tảng"><div><h2>Chấm dứt điệp khúc “được mùa, mất giá”.</h2><p>Kết nối trực tiếp — cắt trung gian — vận chuyển tối ưu.</p><small>Các chỉ số dưới đây là mục tiêu minh họa.</small></div><dl><div><dt>3 phút</dt><dd>Mở gian hàng nông sản</dd></div><div><dt>−40%</dt><dd>Thất thoát sau thu hoạch</dd></div><div><dt>31</dt><dd>Tỉnh thành phủ sóng</dd></div></dl></section>

      <section id="tai-sao-chon" className="start-section" aria-labelledby="start-benefits-title"><div className="start-section-heading"><span className="start-kicker"><Sparkles size={14} aria-hidden="true"/>Tại sao nên chọn onlmallfruit?</span><h2 id="start-benefits-title">Xóa bỏ rào cản thông tin bất cân xứng</h2><p>Nhà vườn chủ động đầu ra, thương lái gom đủ sản lượng, tất cả gặp nhau trên một nền tảng.</p></div><div className="start-card-grid">{benefits.map(({icon:Icon,tone,title,description})=><article className="start-benefit-card" key={title}><span className={`start-feature-icon ${tone}`}><Icon size={27} aria-hidden="true"/></span><h3>{title}</h3><p>{description}</p></article>)}</div></section>

      <section id="he-sinh-thai" className="start-section" aria-labelledby="start-roles-title"><div className="start-section-heading"><span className="start-kicker"><Puzzle size={14} aria-hidden="true"/>Hệ sinh thái cho 3 đối tượng</span><h2 id="start-roles-title">Một nền tảng, ba vai trò</h2><p>Mỗi đối tượng có bộ công cụ riêng, liền mạch trong chuỗi cung ứng.</p></div><div className="start-card-grid">{roles.map(({icon:Icon,tone,title,subtitle,features})=><article className="start-role-card" key={title}><div className={`start-role-heading ${tone}`}><span><Icon size={25} aria-hidden="true"/></span><div><h3>{title}</h3><p>{subtitle}</p></div></div><ul>{features.map(([name,description])=><li key={name}><Check size={16} aria-hidden="true"/><div><h4>{name}</h4><p>{description}</p></div></li>)}</ul></article>)}</div></section>

      <section id="cong-nghe" className="start-section" aria-labelledby="start-tech-title"><div className="start-section-heading"><span className="start-kicker"><Settings size={14} aria-hidden="true"/>Công nghệ cốt lõi</span><h2 id="start-tech-title">Điều tạo nên sự khác biệt</h2><p>Thuật toán AI vận hành phía sau mỗi kết nối trên onlmallfruit.</p></div><div className="start-card-grid">{technology.map(({icon:Icon,title,description},index)=><article className="start-tech-card" key={title}><span className="start-feature-icon green"><Icon size={23} aria-hidden="true"/></span><span className="start-tech-number" aria-hidden="true">0{index+1}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>

      <section className="start-contact" aria-labelledby="start-contact-title"><div><h2 id="start-contact-title">Liên hệ với chúng tôi</h2><p>Đội ngũ onlmallfruit luôn sẵn sàng lắng nghe, tư vấn và đồng hành cùng bà con nhà vườn, quý thương lái và đơn vị vận tải.</p></div><div className="start-contact-links"><a href="tel:+84397279539"><span><Phone size={24}/></span><div><small>Hotline hỗ trợ</small><strong>0397 279 539</strong></div></a><a href="mailto:smartfruit@gmail.com"><span><Mail size={24}/></span><div><small>Email CSKH & Hợp tác</small><strong>smartfruit@gmail.com</strong></div></a></div></section>
    </main>
    <footer className="start-container start-footer"><div className="brand"><Brand/></div><p>Kết nối nông sản Việt Nam</p><Link to="/policy">Chính sách nền tảng</Link></footer>
  </div>;
}
