import {expect,test} from '@playwright/test';
import {installMockApi,loginAs,logout,testIds} from './support/mock-api';

test('policy is public, includes all sections and remains available after login',async({page})=>{
  await installMockApi(page);await page.goto('/policy');
  await expect(page.getByRole('heading',{name:'Chính sách & Bảo mật',exact:true})).toBeVisible();
  await expect(page.locator('.policy-page article h2')).toHaveCount(12);
  await expect(page.getByRole('link',{name:'0397 279 539'})).toHaveAttribute('href','tel:+84397279539');
  await expect(page.getByRole('link',{name:'onlmallfruit@gmail.com',exact:true})).toHaveAttribute('href','mailto:onlmallfruit@gmail.com');
  await loginAs(page,'BUYER');await page.goto('/buyer/policy');await expect(page.locator('#policy-12')).toContainText('Liên hệ');
});

for(const width of [1440,390,320])test(`dashboard summaries, floating assistant and notifications at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:960});const api=await installMockApi(page);
  api.database.trade_reviews.push({id:'review-1',agreement_id:'a',reviewer_id:testIds.BUYER,target_id:testIds.FARMER,rating:5,comment:'Đánh giá mẫu: phối hợp tốt',created_at:new Date().toISOString()});
  api.database.notifications.push({id:'notice-1',recipient_id:testIds.FARMER,kind:'trade_reviews',title:'Bạn nhận được đánh giá giao dịch mới',path:'/farmer/reviews',read_at:null,created_at:new Date().toISOString()});
  await loginAs(page,'FARMER');await expect(page.getByRole('region',{name:'Đánh giá giao dịch',exact:true})).toContainText('5.0/5');
  await expect(page.getByRole('region',{name:'Vận chuyển',exact:true})).toContainText('Chưa có yêu cầu');
  await expect(page.getByRole('region',{name:'Thời tiết tại vườn',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Khu vực thu mua',exact:true})).toBeVisible();
  const assistant=page.getByRole('button',{name:'Hỏi trợ lý',exact:true});await assistant.click();await expect(page.getByRole('dialog',{name:'Trợ lý nhà vườn',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(assistant).toBeFocused();
  await page.getByRole('button',{name:'Mở thông báo (1 chưa đọc)',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Thông báo',exact:true});await dialog.getByRole('link',{name:'Bạn nhận được đánh giá giao dịch mới'}).click();
  await expect(page).toHaveURL(/\/farmer\/reviews$/);expect(api.database.notifications[0].read_at).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto('/farmer/dashboard');await expect(page.getByRole('region',{name:'Đánh giá giao dịch',exact:true})).toContainText('5.0/5');
  await expect(page.getByRole('region',{name:'Khu vực thu mua',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`tmp/customer-dashboard-${width}.png`,fullPage:true});
});

test('Farmer finds a vehicle, Carrier quotes, Farmer accepts and cancels',async({page})=>{
  const api=await installMockApi(page);const lot=api.database.lots[0];lot.province='Đồng Nai';
  api.database.vehicles.push({id:'vehicle-1',carrier_id:testIds.CARRIER,vehicle_type:'ENCLOSED',capacity_kg:8000,provinces:['Đồng Nai','Hồ Chí Minh'],active:true,min_temperature_c:null,max_temperature_c:null});
  await loginAs(page,'FARMER');await page.goto(`/farmer/transport?lotId=${lot.id}`);
  await page.getByLabel('Tỉnh giao hàng').fill('Hồ Chí Minh');await page.getByLabel('Địa chỉ lấy hàng').fill('Vườn kiểm thử');await page.getByLabel('Địa chỉ giao hàng').fill('Kho kiểm thử');
  await page.getByRole('button',{name:'Tìm xe',exact:true}).click();await expect(page.getByText('1 xe phù hợp', {exact:false})).toBeVisible();await page.getByRole('button',{name:'Gửi yêu cầu cho nhà xe'}).click();
  await expect(page.getByRole('status')).toContainText('Đã gửi yêu cầu');expect(api.database.transport_requests).toHaveLength(1);
  await logout(page);await loginAs(page,'CARRIER');await page.goto('/carrier/requests');await page.getByLabel('Cước trọn chuyến (VND)').fill('1500000');await page.getByLabel('Ghi chú báo giá').fill('Đã xác nhận xe trống');
  await page.getByRole('button',{name:'Xác nhận lịch và gửi báo giá'}).click();await expect(page.getByRole('status')).toContainText('Đã cập nhật');
  await logout(page);await loginAs(page,'FARMER');await page.goto('/farmer/transport');await page.getByRole('button',{name:'Chấp nhận báo giá'}).click();
  await expect(page.getByText('Đã thống nhất',{exact:true})).toBeVisible();expect(api.database.transport_requests[0].quote_vnd).toBe(1500000);
  await page.getByRole('button',{name:'Hủy yêu cầu',exact:true}).click();await expect(page.getByText('Đã hủy',{exact:true})).toBeVisible();
});
