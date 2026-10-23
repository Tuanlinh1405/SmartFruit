import { useEffect,useRef,useState } from 'react';
import L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
setWorkerUrl(workerUrl);
export const route:[number,number][]=[[10.94,107.24],[10.91,107.16],[10.88,107.06],[10.84,106.98],[10.80,106.89],[10.78,106.80]];
export default function TripMap({progress}:{progress:number}){
  const ref=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),marker=useRef<L.CircleMarker|null>(null);const [failed,setFailed]=useState(false),[loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!ref.current)return;
    const m=L.map(ref.current,{scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).fitBounds(route,{padding:[25,25]});map.current=m;
    let active=true;
    const background=maplibreGL({style:import.meta.env.VITE_MAP_STYLE_URL||'https://tiles.openfreemap.org/styles/liberty',attributionControl:{customAttribution:'<a href="https://openfreemap.org/">OpenFreeMap</a> © OpenMapTiles · <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}});
    const timer=setTimeout(()=>{if(active){setFailed(true);setLoading(false);}},20_000);
    try{background.addTo(m);background.getMaplibreMap().on('error',()=>{if(active){clearTimeout(timer);setFailed(true);setLoading(false);}});background.getMaplibreMap().on('idle',()=>{clearTimeout(timer);if(active)setLoading(false);});}
    catch{clearTimeout(timer);setFailed(true);setLoading(false);if(!background.getMaplibreMap())background.onRemove=()=>{background.getContainer()?.remove();return background;};}
    L.polyline(route,{color:'#27764c',weight:4,dashArray:'8 5'}).addTo(m);
    L.circleMarker(route[0],{radius:7,color:'#27764c'}).addTo(m).bindTooltip('Long Khánh · Điểm đi mẫu');
    L.circleMarker(route[5],{radius:7,color:'#bd8615'}).addTo(m).bindTooltip('Thủ Đức · Điểm đến mẫu');
    marker.current=L.circleMarker(route[0],{radius:10,color:'#15372a',fillColor:'#31a165',fillOpacity:1}).addTo(m).bindTooltip('Vị trí xe mô phỏng');
    const observer=new ResizeObserver(()=>{m.invalidateSize();background.getMaplibreMap()?.resize();});observer.observe(ref.current);
    return()=>{active=false;clearTimeout(timer);observer.disconnect();m.remove();map.current=null;marker.current=null;};
  },[]);
  useEffect(()=>{const at=progress/100*5,i=Math.min(4,Math.floor(at)),fraction=at-i;marker.current?.setLatLng([route[i][0]+(route[i+1][0]-route[i][0])*fraction,route[i][1]+(route[i+1][1]-route[i][1])*fraction]);},[progress]);
  return <><div ref={ref} className="demo-trip-map" role="region" aria-busy={loading} aria-label="Bản đồ tuyến xe mô phỏng"/>{loading&&<p role="status">Đang tải nền bản đồ…</p>}{failed&&<p role="status">Không tải được nền bản đồ. Tuyến mẫu: Long Khánh → Long Thành → Thủ Đức. Tiến trình và ETA bên cạnh vẫn xem được.</p>}</>;
}
