// Read-only UI smoke checks against the local app and real handover accounts.
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const accounts=JSON.parse(await readFile('tmp/handover-accounts.json','utf8'));
const browser=await chromium.launch();
await mkdir('tmp/feedback23-live',{recursive:true});
try{
 for(const name of ['farmer3','buyer3','carrier3']){
  const account=accounts.find(a=>a.name===name);if(!account)throw Error('Missing handover credential');
  const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:5173/login');await page.getByLabel(/^Email hoặc số điện thoại/).fill(account.email);await page.getByLabel(/^Mật khẩu/).fill(account.password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
   await page.waitForURL(new RegExp(`/${name.replace('3','')}/dashboard$`));await page.getByRole('heading',{level:1}).waitFor();
   if(name!=='carrier3'){await page.locator('.metric-card').first().waitFor({timeout:20000});await page.locator('.buying-area-map').waitFor({timeout:20000});}
   await page.screenshot({path:`tmp/feedback23-live/${name}-dashboard.png`,fullPage:true});
   const prefix=name.replace('3','');
   if(name==='carrier3'){
    await page.goto('http://127.0.0.1:5173/carrier/requests');await page.getByRole('heading',{name:'Yêu cầu gửi đến nhà xe'}).waitFor();await page.getByText('[MẪU]',{exact:false}).first().waitFor();
    const samples=await page.locator('.transport-request').filter({hasText:'[MẪU]'}).count();console.log(JSON.stringify({account:name,login:true,sampleRequests:samples}));
    await page.screenshot({path:'tmp/feedback23-live/carrier-requests.png',fullPage:true});
   }else{
    await page.goto(`http://127.0.0.1:5173/${prefix}/prices`);await page.getByRole('heading',{name:'Dự báo giá',exact:true}).waitFor();
    if(name==='buyer3'){await page.goto('http://127.0.0.1:5173/buyer/profile');await page.getByRole('heading',{name:'Hồ sơ thương lái',exact:true}).waitFor();const ready=await page.getByLabel('Mã số thuế').isEnabled().catch(()=>false);console.log(JSON.stringify({account:name,login:true,profileSchemaReady:ready}));}
    else console.log(JSON.stringify({account:name,login:true,forecast:true}));
   }
   console.log(JSON.stringify({account:name,javascriptErrors:errors.length}));
  }finally{await context.close();}
 }
}finally{await browser.close();}
