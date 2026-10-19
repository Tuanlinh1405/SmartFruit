import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { DateInput, FileUpload, NumberWithUnit, RadioChips, Select, TextArea, TextField } from '../components/ui/fields';
import { Badge } from '../components/ui/badge';
import { Tabs } from '../components/ui/tabs';
import { Modal, Drawer, ConfirmDialog } from '../components/ui/dialog';
import { useToast } from '../components/ui/toast';
import { Card, DemoNotice, EmptyState, ErrorState, FormLayout, LoadingState, PageHeader, PhotoPlaceholder } from '../components/shared/content';
import { DataTable, FilterBar, type Column } from '../components/shared/data-table';
import { formatDate, formatVnd, formatWeight } from '../lib/formatters';
import type { DisplayStatus } from '../types/ui';

interface SampleRow { id: string; name: string; quantity: number; price: number; status: DisplayStatus; }
const rows: SampleRow[] = [
  { id:'sample-1',name:'Sầu riêng Ri6',quantity:5000,price:65000,status:'PUBLISHED' },
  { id:'sample-2',name:'Mít Thái',quantity:1200,price:18000,status:'DRAFT' },
  { id:'sample-3',name:'Thanh long — tên dài để kiểm tra cách trình bày nội dung trên điện thoại',quantity:800,price:22000,status:'PUBLISHED' },
];
const columns: Column<SampleRow>[] = [
  { id:'name',label:'Tên mẫu',render:row=>row.name,sortValue:row=>row.name },
  { id:'quantity',label:'Khối lượng',render:row=>formatWeight(row.quantity),sortValue:row=>row.quantity },
  { id:'price',label:'Giá/kg',render:row=>formatVnd(row.price),sortValue:row=>row.price },
  { id:'status',label:'Trạng thái',render:row=><Badge status={row.status} /> },
];
function ListExample() {
  const [search,setSearch]=useState(''); const [status,setStatus]=useState('');
  const filtered=rows.filter(row=>row.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')) && (!status || row.status===status));
  return <Card title="Mẫu danh sách"><div className="stack"><FilterBar search={search} onSearch={setSearch}><Select label="Trạng thái" value={status} onChange={event=>setStatus(event.target.value)}><option value="">Tất cả</option><option value="DRAFT">Nháp</option><option value="PUBLISHED">Đã đăng</option></Select></FilterBar><DataTable rows={filtered} columns={columns} rowKey={row=>row.id} caption="Danh sách minh họa" /></div></Card>;
}
function FormExample() {
  const toast=useToast(); const [name,setName]=useState(''); const [quantity,setQuantity]=useState(''); const [date,setDate]=useState(''); const [packing,setPacking]=useState('crate'); const [note,setNote]=useState(''); const [submitted,setSubmitted]=useState(false); const [file,setFile]=useState<File|null>(null);
  const nameError=submitted&&!name.trim()?'Vui lòng nhập tên mẫu.':undefined;
  const quantityError=submitted&&(!Number.isFinite(Number(quantity))||Number(quantity)<=0)?'Khối lượng phải lớn hơn 0.':undefined;
  return <FormLayout preview={<Card title="Xem trước"><div className="stack-sm"><PhotoPlaceholder alt="Ảnh mẫu" /><h3>{name||'Tên mẫu chưa nhập'}</h3><p>{quantity&&Number(quantity)>0?formatWeight(Number(quantity)):'Chưa nhập khối lượng'}</p><p>{date?formatDate(date):'Chưa chọn ngày'}</p><p className="muted">{packing==='crate'?'Đóng thùng':'Đóng bao'} · {file?.name||'Chưa chọn ảnh'}</p><p>{note||'Chưa có ghi chú'}</p></div></Card>}><Card title="Mẫu form"><form noValidate className="stack-sm" onSubmit={event=>{event.preventDefault();setSubmitted(true);if(name.trim()&&Number(quantity)>0)toast('Đã kiểm tra dữ liệu mẫu. Không lưu vào database.');}}><TextField label="Tên mẫu" required placeholder="Ví dụ: Sầu riêng Ri6" value={name} error={nameError} onChange={event=>setName(event.target.value)} /><NumberWithUnit label="Khối lượng" unit="kg" required min={0} value={quantity} error={quantityError} onChange={event=>setQuantity(event.target.value)} /><DateInput label="Ngày mẫu" value={date} onChange={event=>setDate(event.target.value)} /><RadioChips label="Đóng gói" value={packing} onChange={setPacking} options={[{value:'crate',label:'Thùng'},{value:'bag',label:'Bao'}]} /><TextArea label="Ghi chú" rows={3} value={note} onChange={event=>setNote(event.target.value)} /><FileUpload label="Ảnh mẫu" onFile={setFile} /><Button type="submit">Kiểm tra form mẫu</Button></form></Card></FormLayout>;
}
export default function UiPage() {
  const toast=useToast(); const [tab,setTab]=useState('examples');
  return <main className="dev-page stack"><Link to="/">← Chọn khu vực</Link><PageHeader eyebrow="Development only" title="UI kit SmartFruit" description="Component dùng chung toàn web theo giao diện Buyer." /><DemoNotice /><Tabs label="Nội dung UI kit" value={tab} onChange={setTab} items={[
    {value:'examples',label:'Mẫu ghép trang',content:<div className="stack"><ListExample /><FormExample /></div>},
    {value:'components',label:'Components & trạng thái',content:<div className="stack"><Card title="Tokens"><div className="swatches">{['forest','leaf','primary','cream','amber','coral','danger'].map(token=><div className="swatch" key={token}><span style={{background:`var(--${token})`}} />{token}</div>)}</div></Card><Card title="Button & overlay"><div className="row"><Button onClick={()=>toast('Thông báo minh họa')}>Hiện thông báo</Button><Button variant="secondary" onClick={()=>toast('Nút phụ minh họa')}>Secondary</Button><Button disabled>Disabled</Button><Button loading>Đang xử lý</Button><Modal title="Modal mẫu" description="Thao tác local; không ghi dữ liệu." trigger={<Button variant="secondary">Mở modal</Button>}><TextField label="Nội dung modal" /><Button onClick={()=>toast('Thao tác mẫu')}>Thử thao tác</Button></Modal><Drawer title="Drawer mẫu" description="Vùng nội dung bên cạnh." trigger={<Button variant="secondary">Mở drawer</Button>}><p>Nội dung minh họa.</p></Drawer><ConfirmDialog title="Xác nhận mẫu" description="Không tạo giao dịch thật." trigger={<Button variant="secondary">Mở xác nhận</Button>} onConfirm={()=>toast('Đã xác nhận minh họa')} /></div></Card><Card title="Badge"> <div className="row">{(['DRAFT','PUBLISHED','OPEN','NEGOTIATING','CONFIRMED_DEMO','DELIVERED_DEMO'] as DisplayStatus[]).map(status=><Badge key={status} status={status} />)}</div></Card><Card title="Trạng thái"><LoadingState /><EmptyState /><ErrorState onRetry={()=>toast('Thử lại minh họa')} /><PhotoPlaceholder src="/missing-example-photo.webp" alt="Ảnh không tải được" /></Card></div>},
  ]} /></main>;
}
