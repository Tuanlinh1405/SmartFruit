import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const example = fileURLToPath(new URL('../.env.example', import.meta.url));
const local = fileURLToPath(new URL('../.env.local', import.meta.url));

try {
  await copyFile(example, local, constants.COPYFILE_EXCL);
  console.log('Đã tạo .env.local cho project Supabase SmartFruit.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Đã có .env.local; giữ nguyên cấu hình hiện tại.');
}

console.log('Chạy npm run check:supabase để kiểm tra kết nối.');
