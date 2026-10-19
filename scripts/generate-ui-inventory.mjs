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
function implementation(entry) {
  if (entry.owner === 'A') return entry.level === 'F' ? 'Đã nối Auth/SDK; chờ nghiệm thu cloud' : entry.level === 'U' ? 'Thông báo demo / policy placeholder' : 'Demo tương tác';
  if (['AUTH-02','AUTH-03'].includes(entry.id)) return 'Đã bỏ; chuyển /login';
  if (entry.id === 'AUTH-01') return 'Login chung; /auth/login là alias';
  if (entry.id === 'AUTH-04') return 'UI trạng thái';
  if (['BUI-12','BUI-13'].includes(entry.id)) return 'Chưa có route tương ứng từ B';
  return 'Code B đã mount; đối chiếu route B/README';
}
const lines = [
  'Sinh từ `src/app/ui-inventory.ts` bằng `node scripts/generate-ui-inventory.mjs` (Node 24). Chỉ vùng giữa hai marker được cập nhật; không sửa tay bảng này. Hướng dẫn và quyết định bên ngoài vùng được giữ nguyên.',
  '',
  `${uiInventory.length} mục: ${pageCount} trang và ${modalCount} modal slots. Modal A đã có nội dung demo và thuộc trang cha; danh sách này giữ UI ID từ baseline. \`/404\` và catch-all dùng cùng thông báo AUTH-04. Owner là người hoàn thiện feature; matching algorithm thuộc B, UI Farmer thuộc A.`,
  '',
  'F/D/U là phạm vi tính năng; trạng thái đã nối code không có nghĩa đã nghiệm thu cloud. Router dùng Auth/guards thật, không có menu role cấp quyền.',
  '',
  '| UI ID | Màn hình | Route / trang cha | Loại | Owner | Mức mục tiêu | Trạng thái |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...uiInventory.map(entry => `| ${entry.id} | ${entry.title} | ${entry.path} | ${entry.kind} | ${entry.owner} | ${entry.level} | ${implementation(entry)} |`),
  '',
  'AUTH-02/03 giữ ID lịch sử nhưng đăng ký/OTP đã bỏ theo quyết định 15/10/2026. AUTH-04 là UI trạng thái. Buyer/Admin giữ route code Linh; registry cũ cần đối chiếu trước khi đánh dấu toàn bộ B hoàn tất.',
  'FUI-13/BUI-13 gộp thông báo/chính sách mức U trong nền này; khi điền feature, phần thông báo fixtures là D, phần văn bản chưa có nghiệp vụ là U.',
  '',
];
const next = document.slice(0, start + startMarker.length) + '\n' + lines.join('\n') + document.slice(end);
if (next !== document) writeFileSync(target, next);
