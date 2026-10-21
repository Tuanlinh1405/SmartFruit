import {afterEach,expect,test,vi} from 'vitest';
import {administrativePlaces,coordinates,findPlaces,normalizeProvince,provincePlace} from './geography';
import {cachedForecast,loadForecast,parseForecast} from './weather';
import {groupAreas,vietnamDate,type AreaRequest} from './areas';
vi.mock('../../../lib/supabase',()=>({supabase:{}}));
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();localStorage.clear();});
test('province normalization handles accents and prefixes but does not merge historic provinces',()=>{
  expect(normalizeProvince('Tỉnh Tiền Giang')).toBe('tien giang');expect(normalizeProvince('Thành phố Đà Nẵng')).toBe('da nang');expect(normalizeProvince('Long An')).not.toBe(normalizeProvince('Tây Ninh'));expect(coordinates(0,0)).toBe(true);expect(coordinates(null,null)).toBe(false);
});
test('only exact unique Vietnamese ADM1 can automatically position a province',async()=>{
  const row={id:7001,name:'Tỉnh Đồng Tháp',latitude:10.4,longitude:105.6,country_code:'VN',feature_code:'ADM1'};
  expect(administrativePlaces([row],'Đồng Tháp')).toHaveLength(1);expect(administrativePlaces([{...row,country_code:'US'}],'Đồng Tháp')).toHaveLength(0);
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({results:[{...row,id:7002,name:'Địa danh không có admin1',feature_code:'PPL',admin1:undefined}]}));vi.stubGlobal('fetch',fetcher);
  expect(await provincePlace('Địa danh không có admin1')).toBeNull();expect(await findPlaces('Địa danh không có admin1')).toHaveLength(1);expect(fetcher).toHaveBeenCalledTimes(1);
  expect(new URL(String(fetcher.mock.calls[0]?.[0])).searchParams.get('countryCode')).toBe('VN');
});
test('ambiguous exact provinces are not picked and geocoding expires after 24 hours',async()=>{
  const row={id:7101,name:'Vùng test 24',latitude:10,longitude:105,country_code:'VN',feature_code:'ADM1'};const fetcher=vi.fn(async()=>Response.json({results:[row,{...row,id:7102}]}));vi.stubGlobal('fetch',fetcher);
  expect(await provincePlace(row.name)).toBeNull();await findPlaces(row.name);expect(fetcher).toHaveBeenCalledTimes(1);
  vi.useFakeTimers();vi.setSystemTime(Date.now()+25*60*60_000);await findPlaces(row.name);expect(fetcher).toHaveBeenCalledTimes(2);
});
test('province IDs resolve ADM1 directly, never a populated place with the same name',async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({id:13494357,name:'Tỉnh Đồng Nai',country_code:'VN',feature_code:'ADM1',latitude:11,longitude:107}));vi.stubGlobal('fetch',fetcher);
  expect((await provincePlace('Đồng Nai'))?.administrative).toBe(true);expect(String(fetcher.mock.calls[0][0])).toContain('/get?id=13494357');
});
const forecast=()=>({timezone:'Asia/Ho_Chi_Minh',current:{temperature_2m:29,relative_humidity_2m:80,wind_speed_10m:12,weather_code:3},daily:{time:['2026-10-20','2026-10-21','2026-10-22'],temperature_2m_min:[24,25,24],temperature_2m_max:[31,32,30],precipitation_probability_max:[70,20,40],weather_code:[61,3,61]}});
test('weather requires complete finite values and the Vietnam timezone',()=>{
  expect(parseForecast(forecast()).days).toHaveLength(3);expect(()=>parseForecast({...forecast(),timezone:'UTC'})).toThrow();expect(()=>parseForecast({...forecast(),current:{...forecast().current,temperature_2m:null}})).toThrow();
});
test('15-minute weather cache preserves old data on provider failure and never mixes locations',async()=>{
  const place={id:22,name:'Test',latitude:10.123,longitude:106.123,representative:false};const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(forecast())).mockResolvedValue(new Response('',{status:503}));vi.stubGlobal('fetch',fetcher);
  const original=await loadForecast(place);await loadForecast(place);expect(fetcher).toHaveBeenCalledTimes(1);
  vi.useFakeTimers();vi.setSystemTime(Date.now()+16*60_000);await expect(loadForecast(place)).rejects.toThrow();expect(cachedForecast(place)).toEqual(original);expect(cachedForecast({...place,latitude:12})).toBeUndefined();
  const url=new URL(String(fetcher.mock.calls[0][0]));expect(url.searchParams.get('timezone')).toBe('Asia/Ho_Chi_Minh');expect(url.searchParams.get('forecast_days')).toBe('3');
});
test('area counts deduplicate multi-region requests and preserve nationwide/unknown groups',()=>{
  const base={id:'r',preferred_provinces:['Tiền Giang','Tỉnh Tiền Giang','Long An']} as AreaRequest;
  const areas=groupAreas([base,base,{...base,id:'global',preferred_provinces:[]},{...base,id:'unknown',preferred_provinces:['Vùng chưa rõ']}]);
  expect(areas).toHaveLength(4);expect(areas.find(a=>a.key==='tien giang')?.requests).toHaveLength(1);expect(areas.find(a=>a.key==='__all__')?.requests[0].id).toBe('global');
  expect(vietnamDate(new Date('2026-10-19T18:00:00Z'))).toBe('2026-10-20');
});
