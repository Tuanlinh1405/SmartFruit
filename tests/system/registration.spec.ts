import { expect, test, type Page } from '@playwright/test';
import { installMockApi } from './support/mock-api';
async function fill(page: Page, role='FARMER') {
  await page.getByLabel(/^Họ và tên/).fill('Người dùng đăng ký');
  await page.getByLabel(/^Email/).fill(`${role.toLowerCase()}@example.test`);
  await page.getByLabel(/Bạn tham gia/).selectOption(role);
  await page.getByLabel(/^Mật khẩu/).fill('TestPassword123!');
  await page.getByLabel(/^Xác nhận mật khẩu/).fill('TestPassword123!');
}
test('login links to registration; confirmation keeps user signed out',async({page})=>{
  const api=await installMockApi(page);await page.goto('/login');await page.getByRole('link',{name:'Đăng ký',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Đăng ký tài khoản'})).toBeVisible();await fill(page);
  await page.getByRole('button',{name:'Tạo tài khoản'}).click();await expect(page.getByRole('heading',{name:'Kiểm tra email để tiếp tục'})).toBeVisible();
  expect(api.calls.filter(c=>c.table==='auth_signup')).toHaveLength(1);expect(api.calls.some(c=>c.table==='complete_registration')).toBe(false);
  await page.goto('/farmer/lots');await expect(page).toHaveURL(/\/login$/);
});
for(const role of ['FARMER','BUYER','CARRIER'])test(`immediate verified ${role} signup resolves role from server and survives F5`,async({page})=>{
  const api=await installMockApi(page,undefined,'immediate');await page.goto('/register');await fill(page,role);
  await page.getByRole('button',{name:'Tạo tài khoản'}).click();await expect(page).toHaveURL(new RegExp(`/${role.toLowerCase()}/dashboard$`));
  expect(api.calls.filter(c=>c.table==='complete_registration')).toHaveLength(1);await page.reload();await expect(page).toHaveURL(new RegExp(`/${role.toLowerCase()}/dashboard$`));
  await page.goto('/admin/users');await expect(page).toHaveURL(/\/403$/);
});
test('invalid form never calls signup; server rejection is retryable',async({page})=>{
  const api=await installMockApi(page,undefined,'error');await page.goto('/register');await fill(page);
  await page.getByLabel(/^Xác nhận mật khẩu/).fill('wrong');await page.getByRole('button',{name:'Tạo tài khoản'}).click();await expect(page.getByRole('alert')).toContainText('chưa khớp');expect(api.calls).toHaveLength(0);
  await page.getByLabel(/^Xác nhận mật khẩu/).fill('TestPassword123!');await page.getByRole('button',{name:'Tạo tài khoản'}).click();await expect(page.getByRole('alert')).toContainText('tạm đóng đăng ký');await expect(page.getByLabel(/^Email/)).toHaveValue('farmer@example.test');
});
test('missing enrollment RPC never grants a role locally',async({page})=>{
  await installMockApi(page,undefined,'immediate');await page.route('**/rest/v1/rpc/complete_registration',route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({code:'PGRST202'})}));
  await page.goto('/register');await fill(page);await page.getByRole('button',{name:'Tạo tài khoản'}).click();await expect(page.getByRole('heading',{name:'Chưa tải được hồ sơ'})).toBeVisible();await expect(page.getByText(/máy chủ chưa cập nhật chức năng/)).toBeVisible();
});
test('registration mobile layout exposes exactly three roles',async({page})=>{
  await installMockApi(page);await page.setViewportSize({width:390,height:844});await page.goto('/register');
  await expect(page.getByRole('option')).toHaveCount(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/registration-mobile.png',fullPage:true});
});
