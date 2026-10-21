import type { Page } from '@playwright/test';
export async function installEnvironmentApi(page:Page) {
  // A self-contained vector style keeps regular UI tests independent of the
  // public provider while exercising the actual MapLibre renderer and worker.
  await page.route('https://tiles.openfreemap.org/**',route=>route.fulfill({json:{
    version:8,sources:{land:{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[100,5],[115,5],[115,25],[100,25],[100,5]]]}}}},
    layers:[{id:'water',type:'background',paint:{'background-color':'#9ebdff'}},{id:'land',type:'fill',source:'land',paint:{'fill-color':'#f8f4f0'}}],
  }}));
  await page.route('https://geocoding-api.open-meteo.com/**',route=>{
    const lookup=new URL(route.request().url()).searchParams.get('id');
    if(lookup)return route.fulfill({json:{id:Number(lookup),name:lookup==='13494360'?'Đồng Tháp':'Không khớp',latitude:10.4,longitude:106.3,country_code:'VN',feature_code:'ADM1'}});
    const name=new URL(route.request().url()).searchParams.get('name')??'';
    const names=['Tiền Giang','Long An','Đồng Tháp'];const index=names.indexOf(name);
    return route.fulfill({json:{results:index<0?[]:[{id:100+index,name:names[index],latitude:10.4+index,longitude:106.3,country_code:'VN',feature_code:'ADM1'}]}});
  });
  await page.route('https://api.open-meteo.com/**',route=>route.fulfill({json:{timezone:'Asia/Ho_Chi_Minh',current:{temperature_2m:29,relative_humidity_2m:80,wind_speed_10m:12,weather_code:3},daily:{time:['2026-10-20','2026-10-21','2026-10-22'],temperature_2m_min:[24,25,24],temperature_2m_max:[31,32,30],precipitation_probability_max:[70,20,40],weather_code:[61,3,61]}}}));
}
