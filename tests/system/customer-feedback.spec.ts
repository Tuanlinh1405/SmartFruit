import {expect,test} from '@playwright/test';
import {installMockApi,loginAs,logout,testIds} from './support/mock-api';

for(const width of [1440,768,390,320])test(`Buyer match cards follow customer layout at ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});const api=await installMockApi(page);
  Object.assign(api.database.buy_requests[0],{quality_requirements:['VietGAP'],packaging_options:['CARTON'],notes:'Nhận hàng tại điểm tập kết.'});
  await loginAs(page,'FARMER');await page.goto(`/farmer/matches?lotId=${api.database.lots[0].id}`);
  const card=page.getByRole('article',{name:'Người mua Buyer công khai test'});
  await expect(card).toBeVisible();await expect(card).toContainText('Tiền Giang');await expect(card).toContainText('Sản lượng nhập');await expect(card).toContainText('Giá nhập');await expect(card).toContainText('Thời gian nhập');await expect(card).toContainText('Thùng carton');
  await expect(card.getByText(/% phù hợp/)).toBeVisible();await expect(card).not.toContainText(/Cosine|E5|Quy tắc|45\s*km/);
  await expect(card.getByRole('button',{name:'Xem chi tiết',exact:true})).toBeVisible();await expect(card.getByRole('button',{name:'Nhắn tin',exact:true})).toBeVisible();await expect(card.getByRole('button',{name:'Gửi đề nghị',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`buyer-match-card-${width}.png`),fullPage:true});
  await card.getByRole('button',{name:'Xem chi tiết',exact:true}).click();const detail=page.getByRole('dialog');await expect(detail).toContainText('Nhận hàng tại điểm tập kết.');expect(api.database.trade_connections).toHaveLength(0);
  await detail.getByRole('button',{name:'Đóng chi tiết',exact:true}).click();await card.getByRole('button',{name:'Gửi đề nghị',exact:true}).click();await expect(page).toHaveURL(/\/farmer\/invitations\?connectionId=.+&focus=offer/);await expect(page.getByRole('status')).toContainText('chờ phản hồi');
});

for(const intent of ['message','offer'])test(`Existing accepted buyer match opens ${intent} without a duplicate invitation`,async({page})=>{
  const api=await installMockApi(page);const lot=api.database.lots[0],request=api.database.buy_requests[0];
  api.database.trade_connections.push({id:'accepted-card-connection',lot_id:lot.id,lot_title:lot.title,buy_request_id:request.id,buyer_id:testIds.BUYER,farmer_id:testIds.FARMER,initiated_by:testIds.BUYER,status:'ACCEPTED',created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  await loginAs(page,'FARMER');await page.goto(`/farmer/matches?lotId=${lot.id}`);
  await page.getByRole('button',{name:intent==='message'?'Nhắn tin':'Gửi đề nghị',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/farmer/negotiations\\?connectionId=accepted-card-connection&focus=${intent}`));
  await expect(intent==='message'?page.getByLabel('Tin nhắn',{exact:true}):page.getByLabel('Giá đề nghị (VND/kg)',{exact:true})).toBeFocused();expect(api.database.trade_connections).toHaveLength(1);
});

for(const width of [1440,768,390,320])test(`October 23 buyer profile, forecast and carrier demo layout at ${width}`,async({page},info)=>{
  test.setTimeout(60000);
  await page.setViewportSize({width,height:1000});const api=await installMockApi(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await loginAs(page,'BUYER');
  await expect(page.locator('.workspace-sidebar a[href="/buyer/notifications"]')).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Đường dẫn'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Mật độ nguồn cung',exact:true})).toBeVisible();
  await page.goto('/buyer/profile');await expect(page.getByLabel('Mã số thuế')).toBeVisible();
  await expect(page.getByText('Chưa xác minh',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===1440||width===390)await page.screenshot({path:info.outputPath(`buyer-profile-${width}.png`),fullPage:true});
  await page.goto('/buyer/prices');await expect(page.locator('.market-demo>.notice')).toContainText('giả lập');
  await page.getByLabel('Loại quả').selectOption('1');await expect(page.getByRole('img',{name:/Biểu đồ giá minh họa Mít/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===1440)await page.screenshot({path:info.outputPath('forecast.png'),fullPage:true});
  await logout(page);await loginAs(page,'CARRIER');await page.goto('/carrier/tracking');
  await expect(page.locator('.demo-trip-map')).toHaveAttribute('aria-busy','false');
  await page.getByRole('button',{name:'Đặt lại',exact:true}).click();await expect(page.getByRole('progressbar')).toHaveAttribute('value','0');
  await page.getByRole('button',{name:'Chạy mô phỏng',exact:true}).click();await expect(page.getByRole('progressbar')).not.toHaveAttribute('value','0');
  await page.getByRole('button',{name:'Tạm dừng',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===1440||width===390)await page.screenshot({path:info.outputPath(`tracking-${width}.png`),fullPage:true});
  await page.goto('/carrier/reviews');await page.getByRole('button',{name:/Lê Văn Cường/}).click();await expect(page.getByText('[MẪU] Phối hợp tốt và cập nhật hành trình đầy đủ.')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(api.calls.filter(c=>['create_transport_request','respond_transport_request'].includes(c.table))).toHaveLength(0);expect(errors).toEqual([]);
});

test('buyer market summary uses compact fruit-colored cards at all viewport sizes',async({page},info)=>{
  await installMockApi(page);
  await page.route('**/rest/v1/rpc/buyer_market_summary',route=>route.fulfill({json:[
    {fruit_name:'Mít',lot_count:2,quantity_kg:6000,min_price:14000,max_price:15000},
    {fruit_name:'Sầu riêng',lot_count:5,quantity_kg:52000,min_price:65000,max_price:72000},
    {fruit_name:'Thanh long',lot_count:3,quantity_kg:23000,min_price:20000,max_price:100000},
  ]}));
  await page.setViewportSize({width:1440,height:1000});await loginAs(page,'BUYER');
  await page.addStyleTag({content:'* { scroll-behavior: auto !important; }'});
  const summary=page.getByRole('region',{name:'Nguồn cung đang công bố',exact:true});
  const cards=summary.locator('.buyer-market-card');await expect(cards).toHaveCount(3);
  expect(await cards.evaluateAll(elements=>elements.map(el=>getComputedStyle(el).borderLeftColor))).toEqual(['rgb(237, 140, 36)','rgb(230, 188, 32)','rgb(223, 66, 102)']);
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1000});await summary.scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const boxes=await cards.evaluateAll(elements=>elements.map(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,overflow:el.scrollWidth>el.clientWidth})));
    expect(boxes.every(box=>!box.overflow&&box.height<180)).toBe(true);
    if(width===1440){expect(boxes[0].y).toBe(boxes[2].y);expect(boxes[0].width).toBeLessThan(400);}
    await summary.screenshot({path:info.outputPath(`buyer-market-${width}.png`)});
  }
});

test('buyer business profile keeps failed uploads, saves privately, reloads and cancels edits',async({page})=>{
  const api=await installMockApi(page);await loginAs(page,'BUYER');await page.goto('/buyer/profile');
  await page.getByLabel('Tên hiển thị').fill('Trần Minh An');await page.getByLabel('Tên tổ chức').fill('Thu mua An Phú');await page.getByLabel('Tỉnh / thành phố').fill('Hồ Chí Minh');
  await page.getByLabel('Số điện thoại cơ sở').fill('0903 123 456');await page.getByLabel('Email cơ sở').fill('an@example.test');await page.getByLabel('Mã số thuế').fill('1234567890');await page.getByLabel('Số giấy phép kinh doanh').fill('GP-123');await page.getByLabel('Họ tên người đại diện cơ sở').fill('Trần Minh An');
  const file={name:'license.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVYkAAAAASUVORK5CYII=','base64')};
  await page.getByLabel('Chọn ảnh minh chứng').setInputFiles({...file,name:'bad.svg',mimeType:'image/svg+xml'});await expect(page.getByRole('alert')).toContainText('JPG');
  await page.getByLabel('Chọn ảnh minh chứng').setInputFiles(file);await page.getByLabel('Loại minh chứng 1').fill('Giấy phép kinh doanh');
  await page.getByRole('checkbox').check();
  await page.route('**/storage/v1/object/buyer-evidence/**',route=>route.fulfill({status:500,json:{message:'Injected upload failure'}}),{times:1});
  await page.getByRole('button',{name:'Lưu hồ sơ',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Thông tin và ảnh đang chọn được giữ lại');await expect(page.getByLabel('Mã số thuế')).toHaveValue('1234567890');await expect(page.getByLabel('Loại minh chứng 1')).toHaveValue('Giấy phép kinh doanh');
  await page.getByRole('button',{name:'Lưu hồ sơ',exact:true}).click();await expect(page.getByRole('status')).toContainText('Đã lưu hồ sơ và minh chứng');
  expect(api.database.buyer_profiles[0].business_phone).toBe('+84903123456');expect(api.database.buyer_evidence).toHaveLength(1);
  await page.reload();await expect(page.getByLabel('Mã số thuế')).toHaveValue('1234567890');await expect(page.getByLabel('Loại minh chứng 1')).toHaveValue('Giấy phép kinh doanh');
  await page.getByLabel('Tên tổ chức').fill('Chưa lưu');await page.getByRole('button',{name:'Hủy',exact:true}).click();await expect(page.getByLabel('Tên tổ chức')).toHaveValue('Thu mua An Phú');
});

test('carrier can record a clearly labeled sample incident for the selected trip',async({page})=>{
  const api=await installMockApi(page);await loginAs(page,'CARRIER');await page.goto('/carrier/tracking');
  await page.getByRole('button',{name:'Báo cáo sự cố chuyến đi',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Báo cáo sự cố chuyến đi',exact:true});
  await expect(dialog).toContainText('chưa gửi báo cáo thật');
  await expect(dialog.getByRole('button',{name:'Ghi nhận báo cáo mẫu'})).toBeDisabled();
  await dialog.getByLabel('Loại sự cố').selectOption('Giao thông / chậm giao hàng');
  await dialog.getByLabel('Mô tả sự cố').fill('Kẹt xe tại cửa ngõ, dự kiến chậm 20 phút.');
  await dialog.getByRole('button',{name:'Ghi nhận báo cáo mẫu'}).click();
  await expect(page.locator('.demo-incident-result')).toContainText('Kẹt xe');
  await page.getByLabel('Chọn chuyến mẫu').selectOption('trip-b');await expect(page.locator('.demo-incident-result')).toHaveCount(0);
  await page.getByLabel('Chọn chuyến mẫu').selectOption('trip-a');await expect(page.locator('.demo-incident-result')).toContainText('Kẹt xe');
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1000});
    await page.getByRole('button',{name:'Báo cáo sự cố chuyến đi',exact:true}).click();
    await expect(dialog.getByLabel('Mô tả sự cố')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await dialog.getByRole('button',{name:'Hủy',exact:true}).click();
  }
  expect(api.calls.filter(c=>['create_transport_request','respond_transport_request'].includes(c.table))).toHaveLength(0);
});

test('trip information remains usable when the background map fails',async({page})=>{
  await installMockApi(page);await page.route('https://tiles.openfreemap.org/**',route=>route.abort());
  await loginAs(page,'CARRIER');await page.goto('/carrier/tracking');
  await expect(page.getByText(/Không tải được nền bản đồ/)).toBeVisible();
  await expect(page.getByText('Long Khánh → Long Thành → Thủ Đức',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Đặt lại',exact:true}).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value','0');
});

test('buyer request rows show business facts, status colors and stay inside mobile viewport',async({page},info)=>{
  const api=await installMockApi(page);api.database.buy_requests.push({...api.database.buy_requests[0],id:'closed-row',title:'Nhu cầu đã đóng',status:'CLOSED'});
  await loginAs(page,'BUYER');await page.goto('/buyer/requests');
  await expect(page.locator('.request-closed')).toContainText('Đã đóng');
  expect(await page.locator('.request-closed .status-pill').evaluate(el=>getComputedStyle(el).color)).toBe('rgb(172, 41, 41)');
  await expect(page.locator('.request-open')).toContainText('Thời gian lấy hàng');
  await page.screenshot({path:info.outputPath('buyer-requests.png'),fullPage:true});
  await page.setViewportSize({width:320,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

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
