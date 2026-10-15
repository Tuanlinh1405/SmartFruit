import { expect, test } from '@playwright/test';
test('examples filter, sort, validate and update preview without backend',async({page})=>{
  const errors:string[]=[];const backend:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('supabase.co'))backend.push(request.url());});
  await page.goto('/dev/ui');await page.getByLabel('Tìm kiếm').fill('Mít');await expect(page.getByRole('cell',{name:'Mít Thái',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'Sầu riêng Ri6',exact:true})).toHaveCount(0);
  await page.getByLabel('Tìm kiếm').fill('không tồn tại');await expect(page.getByText('Không tìm thấy kết quả')).toBeVisible();await page.getByLabel('Tìm kiếm').fill('');await page.getByLabel('Trạng thái',{exact:true}).selectOption('DRAFT');await expect(page.getByRole('row')).toHaveCount(2);await page.getByLabel('Trạng thái',{exact:true}).selectOption('');
  await page.getByRole('button',{name:'Khối lượng',exact:true}).click();await expect(page.getByRole('columnheader',{name:'Khối lượng'})).toHaveAttribute('aria-sort','ascending');
  await page.getByRole('button',{name:'Kiểm tra form mẫu'}).click();await expect(page.getByText('Vui lòng nhập tên mẫu.')).toBeVisible();await expect(page.getByText('Khối lượng phải lớn hơn 0.')).toBeVisible();
  await page.getByLabel('Tên mẫu').fill('Mẫu kiểm thử');await page.getByRole('spinbutton',{name:/Khối lượng/}).fill('1500');await page.getByLabel('Ngày mẫu').fill('2026-10-20');await page.getByLabel('Bao',{exact:true}).check();await expect(page.getByRole('complementary',{name:'Xem trước'})).toContainText('Mẫu kiểm thử');await expect(page.getByRole('complementary',{name:'Xem trước'})).toContainText('1,5 tấn');await expect(page.getByRole('complementary',{name:'Xem trước'})).toContainText('20/10/2026');
  await page.locator('input[type=file]').setInputFiles({name:'x.txt',mimeType:'text/plain',buffer:Buffer.from('x')});await expect(page.getByText('Định dạng file không được hỗ trợ.')).toBeVisible();
  await page.getByRole('button',{name:'Kiểm tra form mẫu'}).click();await expect(page.locator('.toast')).toContainText('Không lưu vào database');expect(errors).toEqual([]);expect(backend).toEqual([]);
});
test('overlays, toast, tabs and focus work with keyboard',async({page})=>{
  await page.goto('/dev/ui');await page.getByRole('tab',{name:'Mẫu ghép trang'}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'Components & trạng thái'})).toBeFocused();
  const trigger=page.getByRole('button',{name:'Mở modal',exact:true});await trigger.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();for(let i=0;i<5;i++){await page.keyboard.press('Tab');expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);}await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  await page.getByRole('button',{name:'Mở drawer'}).click();await page.getByRole('dialog').getByRole('button',{name:'Đóng',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Mở xác nhận'}).click();await page.getByRole('button',{name:'Hủy',exact:true}).click();await expect(page.locator('.toast')).toHaveCount(0);await page.getByRole('button',{name:'Mở xác nhận'}).click();await page.getByRole('button',{name:'Xác nhận minh họa'}).click();await expect(page.locator('.toast')).toHaveText('Đã xác nhận minh họa');await page.getByRole('button',{name:'Đóng thông báo'}).click();await expect(page.locator('.toast')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Disabled'})).toBeDisabled();await expect(page.getByRole('button',{name:'Đang xử lý'})).toBeDisabled();
});
for(const width of [1440,768,390])test(`UI kit visual at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.goto('/dev/ui');await page.evaluate(()=>document.fonts.ready);await page.getByLabel('Tên mẫu').fill('Tên mẫu rất dài để kiểm tra bố cục và khả năng đọc trên màn hình nhỏ của người dùng');await page.getByRole('spinbutton',{name:/Khối lượng/}).fill('5000');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(await page.evaluate(()=>document.fonts.check('16px "Plus Jakarta Sans Variable"','Nhà vườn'))).toBe(true);
  await page.getByRole('tab',{name:'Components & trạng thái'}).click();await expect(page.getByText('Ảnh không tải được',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('primary text contrast meets 4.5 and reduced motion is respected',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/dev/ui');
  const contrast=await page.evaluate(()=>{const hex=getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().slice(1);const rgb=hex.match(/../g)!.map(part=>parseInt(part,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);const luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];return 1.05/(luminance+.05);});expect(contrast).toBeGreaterThanOrEqual(4.5);await expect(page.getByRole('button',{name:'Kiểm tra form mẫu'})).toHaveCSS('transition-duration','0s');
});


