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
const lines = [
  'Sinh từ `src/app/ui-inventory.ts` bằng `node scripts/generate-ui-inventory.mjs` (Node 24). Chỉ vùng giữa hai marker được cập nhật; không sửa tay bảng này. Hướng dẫn và quyết định bên ngoài vùng được giữ nguyên.',
  '',
  `${uiInventory.length} mục: ${pageCount} trang và ${modalCount} modal slots. Modal chưa có nội dung nghiệp vụ; chỉ được ghi nhận tại trang cha. \`/404\` và catch-all dùng cùng thông báo AUTH-04. Owner là người hoàn thiện feature; matching algorithm thuộc B, UI Farmer thuộc A.`,
  '',
  'F/D/U là mức mục tiêu khi triển khai nghiệp vụ, không có nghĩa skeleton đã lưu dữ liệu hoặc kiểm tra quyền. Menu role chỉ phục vụ trình bày.',
  '',
  '| UI ID | Màn hình | Route / trang cha | Loại | Owner | Mức mục tiêu | Trạng thái |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...uiInventory.map(entry => `| ${entry.id} | ${entry.title} | ${entry.path} | ${entry.kind} | ${entry.owner} | ${entry.level} | Skeleton${entry.kind === 'modal' ? ' (slot)' : ''} |`),
  '',
  'AUTH-02/03 giữ đăng ký/OTP demo theo TDD v0.4. AUTH-04 là UI trạng thái. Admin là thiết kế đề xuất, chưa có mockup chi tiết được duyệt.',
  'FUI-13/BUI-13 gộp thông báo/chính sách mức U trong nền này; khi điền feature, phần thông báo fixtures là D, phần văn bản chưa có nghiệp vụ là U.',
  '',
];
const next = document.slice(0, start + startMarker.length) + '\n' + lines.join('\n') + document.slice(end);
if (next !== document) writeFileSync(target, next);
