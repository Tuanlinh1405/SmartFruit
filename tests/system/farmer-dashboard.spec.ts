import {expect,test} from '@playwright/test';
import {installMockApi,loginAs,testIds} from './support/mock-api';

for(const width of [1440,390])test(`Single overview without tabs and notification bell at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:960});await installMockApi(page);await loginAs(page,'FARMER');
  await expect(page.getByRole('tablist')).toHaveCount(0);
  const navigation=page.locator('.workspace-sidebar');
  for(const name of ['Giá tham khảo','Thời tiết & khuyến nghị','Bản đồ thương lái'])await expect(navigation.getByRole('link',{name,exact:true})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Thống kê lô hàng',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Thời tiết tại vườn',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Khu vực thu mua',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Giá tham khảo',exact:true})).toContainText('Chưa có nguồn giá thị trường');
  await page.reload();await expect(page.getByRole('region',{name:'Thời tiết tại vườn',exact:true})).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
  const bell=page.getByRole('button',{name:'Mở thông báo',exact:true});await bell.click();
  const notices=page.getByRole('dialog',{name:'Thông báo',exact:true});await expect(notices).toContainText('Chưa có thông báo');
  await page.keyboard.press('Escape');await expect(notices).toHaveCount(0);await expect(bell).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`tmp/farmer-compact-${width}.png`,fullPage:true});
});

for(const target of ['prices','weather','map'] as const)test(`Saved ${target} links return to the single overview`,async({page})=>{
  await installMockApi(page);await loginAs(page,'FARMER');await page.goto(`/farmer/${target}`);
  await expect(page).toHaveURL(/\/farmer\/dashboard$/);
  await page.goto(`/farmer/dashboard?tab=${target}&from=saved`);
  await expect(page).toHaveURL(/\/farmer\/dashboard\?from=saved$/);
  await expect(page.getByRole('tab')).toHaveCount(0);
  for(const label of ['Giá tham khảo','Thời tiết tại vườn','Khu vực thu mua'])await expect(page.getByRole('region',{name:label,exact:true})).toBeVisible();
});

for(const width of [1440,390,320])test(`Farmer live dashboard weather, buying areas, filters and refresh at ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});const api=await installMockApi(page);
  api.database.farmer_profiles.push({user_id:testIds.FARMER,farm_name:'Vườn test',province:'Tiền Giang',latitude:10.4,longitude:106.3});
  const source=api.database.buy_requests[0];Object.assign(source,{required_end:'2099-11-05',preferred_provinces:['Tiền Giang','Tỉnh Tiền Giang','Long An']});
  api.database.buy_requests.push({...source,id:'no-region',title:'Nhu cầu toàn quốc',preferred_provinces:[]},{...source,id:'unknown',title:'Nhu cầu vùng chưa rõ',preferred_provinces:['Không xác định']},{...source,id:'closed',status:'CLOSED',title:'Nhu cầu đã đóng'},{...source,id:'expired',required_end:'2000-01-01',title:'Nhu cầu hết hạn'});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await loginAs(page,'FARMER');
  const weather=page.getByRole('region',{name:'Thời tiết tại vườn',exact:true}),areas=page.getByRole('region',{name:'Khu vực thu mua',exact:true});
  await expect(weather).toContainText('29°C');await expect(weather).toContainText('Theo tọa độ hồ sơ vườn');await expect(weather).toContainText('Khả năng mưa hôm nay: 70%');
  await areas.getByText('Lọc và tải lại khu vực',{exact:true}).click();
  await expect(areas).toContainText('3 nhu cầu riêng biệt');await expect(areas).not.toContainText('Nhu cầu đã đóng');await expect(areas).not.toContainText('Nhu cầu hết hạn');
  await expect(areas.getByRole('region',{name:'Bản đồ khu vực thu mua',exact:true})).toBeVisible();
  await expect(areas.locator('canvas.maplibregl-canvas')).toBeVisible();
  await expect(areas.locator('.buying-area-map')).toHaveAttribute('aria-busy','false');
  await expect(areas.locator('.leaflet-control-attribution')).toContainText('OpenFreeMap');
  await expect(areas.locator('.leaflet-marker-icon[title="Khu vực Tiền Giang"]')).toBeVisible();await areas.locator('.leaflet-marker-icon[title="Khu vực Tiền Giang"]').click();
  await areas.getByRole('button',{name:'Xem nhu cầu tại Tiền Giang',exact:true}).click();await expect(areas.getByLabel('Tỉnh thu mua')).toHaveValue('tien giang');await expect(areas).toContainText('1 nhu cầu riêng biệt');
  await expect(areas.getByRole('button',{name:'Thu gọn nhu cầu',exact:false})).toHaveAttribute('aria-expanded','true');await expect(areas.getByText('Mua Ri6 test',{exact:true})).toBeVisible();await expect(page).toHaveURL(/\/farmer\/dashboard$/);
  await areas.getByRole('button',{name:'Chỉ xem danh sách',exact:true}).click();await expect(areas.locator('.buying-area-map')).toHaveCount(0);
  await areas.getByLabel('Tỉnh thu mua').selectOption('khong xac dinh');await expect(areas).toContainText('Chưa xác định được điểm đại diện');
  await weather.getByText('Chọn địa điểm dự báo',{exact:true}).click();
  await weather.getByLabel('Tìm địa điểm thời tiết').fill('Long An');await weather.getByRole('button',{name:'Tìm địa điểm',exact:true}).click();await weather.getByLabel('Chọn địa điểm tham khảo').selectOption('101');await expect(weather).toContainText('Địa điểm đại diện');
  await page.reload();await expect(weather).toContainText('Theo tọa độ hồ sơ vườn');await expect(areas).toContainText('3 nhu cầu riêng biệt');await areas.getByText('Lọc và tải lại khu vực',{exact:true}).click();
  await expect(areas.getByLabel('Loại quả khu vực')).toBeVisible();await areas.getByLabel('Loại quả khu vực').selectOption('fruit-1');await expect(areas).toContainText('3 nhu cầu riêng biệt');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  await page.screenshot({path:info.outputPath(`farmer-dashboard-${width}.png`),fullPage:true});
});
test('Farmer chooses weather without silently assuming location; provider and tile failures remain explicit',async({page})=>{
  const api=await installMockApi(page);api.database.buy_requests[0].required_end='2099-01-01';api.database.buy_requests[0].preferred_provinces=['Tiền Giang'];
  await page.route('https://tiles.openfreemap.org/**',route=>route.abort());await page.route('https://api.open-meteo.com/**',route=>route.fulfill({status:503,body:'unavailable'}));
  await loginAs(page,'FARMER');const w=page.getByRole('region',{name:'Thời tiết tại vườn',exact:true});await expect(w).toContainText('Chưa có vị trí dự báo');await expect(w).not.toContainText('29°C');
  await w.getByLabel('Tìm địa điểm thời tiết').fill('Tiền Giang');await w.getByRole('button',{name:'Tìm địa điểm',exact:true}).click();await w.getByLabel('Chọn địa điểm tham khảo').selectOption('100');await expect(w.getByRole('alert')).toContainText('Không tải được dự báo mới');
  const areas=page.getByRole('region',{name:'Khu vực thu mua',exact:true});await expect(areas.getByText('Không tải được một phần nền bản đồ.',{exact:false})).toBeVisible();await expect(areas).toContainText('Mua Ri6 test');
});

for(const recovery of ['button','online'] as const)test(`Buying area map recovers from tile failures via ${recovery}`,async({page})=>{
  const api=await installMockApi(page);api.database.buy_requests[0].required_end='2099-01-01';api.database.buy_requests[0].preferred_provinces=['Tiền Giang'];
  let failing=true;
  await page.route('https://tiles.openfreemap.org/**',route=>failing?route.abort():route.fallback());
  await loginAs(page,'FARMER');
  const areas=page.getByRole('region',{name:'Khu vực thu mua',exact:true});
  const retry=areas.getByRole('button',{name:'Thử lại nền bản đồ',exact:true});
  await expect(areas.getByText('Không tải được một phần nền bản đồ.',{exact:false})).toBeVisible();
  await expect(retry).toBeEnabled();
  failing=false;
  if(recovery==='button')await retry.click();
  else await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect(areas.getByText('Không tải được một phần nền bản đồ.',{exact:false})).toHaveCount(0);
  await expect(areas.locator('canvas.maplibregl-canvas')).toBeVisible();
  await expect(areas.locator('.buying-area-map')).toHaveAttribute('aria-busy','false');
  await expect(areas.locator('.leaflet-control-attribution')).toContainText('OpenFreeMap');
  await areas.locator('.leaflet-marker-icon[title="Khu vực Tiền Giang"]').click();
  await expect(areas.getByRole('button',{name:'Xem nhu cầu tại Tiền Giang',exact:true})).toBeVisible();
  await expect(areas).toContainText('Mua Ri6 test');
});

test('Unavailable WebGL keeps the list and markers usable through retry and remount',async({page})=>{
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=(function(this:HTMLCanvasElement,id:string,...args:unknown[]){
      if(id.includes('webgl'))return null;
      return Reflect.apply(original,this,[id,...args]);
    }) as typeof original;
  });
  const api=await installMockApi(page);api.database.buy_requests[0].required_end='2099-01-01';api.database.buy_requests[0].preferred_provinces=['Tiền Giang'];
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await loginAs(page,'FARMER');
  const areas=page.getByRole('region',{name:'Khu vực thu mua',exact:true});
  await areas.getByText('Lọc và tải lại khu vực',{exact:true}).click();
  await expect(areas.getByRole('button',{name:'Thử lại nền bản đồ',exact:true})).toBeVisible();
  await areas.getByRole('button',{name:'Thử lại nền bản đồ',exact:true}).click();
  await areas.locator('.leaflet-marker-icon[title="Khu vực Tiền Giang"]').click();
  await expect(areas.getByRole('button',{name:'Xem nhu cầu tại Tiền Giang',exact:true})).toBeVisible();
  await areas.getByRole('button',{name:'Chỉ xem danh sách',exact:true}).click();
  await areas.getByRole('button',{name:'Xem bản đồ',exact:true}).click();
  await expect(areas.getByRole('button',{name:'Thử lại nền bản đồ',exact:true})).toBeVisible();
  await expect(areas).toContainText('Mua Ri6 test');expect(errors).toEqual([]);
});
