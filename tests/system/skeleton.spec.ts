import { expect, test } from '@playwright/test';
import { pageInventory, roleMeta } from '../../src/app/ui-inventory';
import type { Role } from '../../src/types/ui';

for (const entry of pageInventory) {
  test(`${entry.id} opens and refreshes: ${entry.path}`, async ({ page }) => {
    const errors:string[]=[]; const requests:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});page.on('request',request=>{if(request.url().includes('supabase.co'))requests.push(request.url());});
    await page.goto(entry.path);
    const heading=entry.id==='AUTH-04'?'Không có quyền truy cập':entry.title;
    await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
    if(entry.role){await expect(page.getByRole('navigation',{name:'Đường dẫn'})).toContainText(entry.title);await expect(page.getByRole('link',{name:entry.title,exact:true})).toHaveAttribute('aria-current','page');}
    await page.reload();await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();expect(errors).toEqual([]);expect(requests).toEqual([]);
  });
}
test('unknown routes and dev UI are unavailable in production',async({page})=>{
  await page.goto('/dev/ui');await expect(page.getByRole('heading',{name:'Không tìm thấy trang'})).toBeVisible();await page.goto('/unknown');await page.getByRole('link',{name:'Quay lại trang đầu'}).click();await expect(page).toHaveURL(/\/$/);await expect(page.getByRole('link',{name:'Xem UI kit'})).toHaveCount(0);
});
for(const width of [1440,768,390])for(const role of Object.keys(roleMeta) as Role[]){
  test(`${role} shell at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:960});await page.goto(`${roleMeta[role].prefix}/dashboard`);await page.evaluate(()=>document.fonts.ready);
    if(width===390){const trigger=page.getByRole('button',{name:'Mở menu'});await trigger.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await page.keyboard.press('Tab');expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await trigger.click();await page.getByRole('dialog').getByRole('link',{name:role==='FARMER'?'Hồ sơ nhà vườn':role==='BUYER'?'Nhu cầu thu mua':role==='CARRIER'?'Hồ sơ & danh sách xe':'Quản lý người dùng',exact:true}).click();await expect(dialog).toHaveCount(0);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  });
}
