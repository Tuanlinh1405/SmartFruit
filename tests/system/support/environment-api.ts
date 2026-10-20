import type { Page } from '@playwright/test';
export async function installEnvironmentApi(page:Page) {
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6Xl8AAAAASUVORK5CYII=','base64');
  await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',body:png}));
  await page.route('https://geocoding-api.open-meteo.com/**',route=>{
    const lookup=new URL(route.request().url()).searchParams.get('id');
    if(lookup)return route.fulfill({json:{id:Number(lookup),name:lookup==='13494360'?'Đồng Tháp':'Không khớp',latitude:10.4,longitude:106.3,country_code:'VN',feature_code:'ADM1'}});
    const name=new URL(route.request().url()).searchParams.get('name')??'';
    const names=['Tiền Giang','Long An','Đồng Tháp'];const index=names.indexOf(name);
    return route.fulfill({json:{results:index<0?[]:[{id:100+index,name:names[index],latitude:10.4+index,longitude:106.3,country_code:'VN',feature_code:'ADM1'}]}});
  });
  await page.route('https://api.open-meteo.com/**',route=>route.fulfill({json:{timezone:'Asia/Ho_Chi_Minh',current:{temperature_2m:29,relative_humidity_2m:80,wind_speed_10m:12,weather_code:3},daily:{time:['2026-10-20','2026-10-21','2026-10-22'],temperature_2m_min:[24,25,24],temperature_2m_max:[31,32,30],precipitation_probability_max:[70,20,40],weather_code:[61,3,61]}}}));
}
