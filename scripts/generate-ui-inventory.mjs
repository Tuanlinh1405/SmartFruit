import { readFileSync, writeFileSync } from 'node:fs';
import { uiInventory } from '../src/app/ui-inventory.ts';

const target = new URL('../docs/ui.md', import.meta.url);
const document = readFileSync(target, 'utf8');
const startMarker = '<!-- UI-INVENTORY:START -->';
const endMarker = '<!-- UI-INVENTORY:END -->';
const start = document.indexOf(startMarker);
const end = document.indexOf(endMarker);
if (start < 0 || end < start || document.lastIndexOf(startMarker) !== start || document.lastIndexOf(endMarker) !== end) {
  throw new Error('docs/ui.md phải có đúng một cặp UI-INVENTORY:START/END theo đúng thứ tự. Không ghi file.');
}
const pageCount = uiInventory.filter(entry => entry.kind === 'page').length;
const modalCount = uiInventory.length - pageCount;
const statusLabels = { live: 'Dữ liệu thật', partial: 'Đọc dữ liệu thật; CRUD nâng cao chờ Dev A', deferred: 'Hoãn / chưa hỗ trợ' };
const lines = [
  'Sinh từ `src/app/ui-inventory.ts` bằng `node scripts/generate-ui-inventory.mjs` (Node 24). Chỉ vùng giữa hai marker được cập nhật; không sửa tay bảng này. Hướng dẫn và quyết định bên ngoài vùng được giữ nguyên.',
  '',
  `${uiInventory.length} mục: ${pageCount} trang và ${modalCount} luồng thuộc trang cha. Một số luồng hiển thị inline thay vì modal riêng. Owner theo phân công; matching thuộc B, CRUD lô/xe nâng cao thuộc A.`,
  '',
  'F: đã nối nghiệp vụ thật; U: hoãn. Cột trạng thái phân biệt phần chỉ đọc với phần đã có thao tác lưu. Auth/RoleGuard và RLS tiếp tục kiểm tra quyền; menu không cấp quyền.',
  '',
  '| UI ID | Màn hình | Route / trang cha | Loại | Owner | Mức mục tiêu | Trạng thái |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...uiInventory.map(entry => `| ${entry.id} | ${entry.title} | ${entry.path} | ${entry.kind} | ${entry.owner} | ${entry.level} | ${entry.id === 'AUTH-04' ? 'UI trạng thái 403/404' : statusLabels[entry.status ?? 'live']} |`),
  '',
  'Đăng ký/OTP đã bỏ theo quyết định dự án. Đăng nhập email hoặc SĐT + mật khẩu Supabase Auth.',
  'Thông báo, bản đồ, vận chuyển và API bên ngoài chưa triển khai; không hiển thị giao dịch giả thành công.',
  '',
];
const next = document.slice(0, start + startMarker.length) + '\n' + lines.join('\n') + document.slice(end);
if (next !== document) writeFileSync(target, next);
