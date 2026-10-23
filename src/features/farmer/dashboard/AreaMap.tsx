import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { BuyingArea } from './areas';
import type { Place } from './geography';

setWorkerUrl(workerUrl);
const styleUrl=import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';
const attribution='<a href="https://openfreemap.org/">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export default function AreaMap({ areas, places, onSelect, supply=false }: { supply?:boolean; areas: BuyingArea[]; places: Record<string,Place>; onSelect: (key: string)=>void }) {
  const element=useRef<HTMLDivElement>(null),mapRef=useRef<L.Map|null>(null);const [failed,setFailed]=useState(false);
  const retryTiles=useRef<()=>void>(()=>{});
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!element.current)return;
    const map=L.map(element.current,{scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,minZoom:1,maxZoom:18,maxBounds:[[-85,-Infinity],[85,Infinity]],maxBoundsViscosity:1}).setView([16,107],5);mapRef.current=map;
    // Keep the Leaflet markers and viewport when replacing a failed background.
    // Errors can include style, vector tiles, fonts, sprites or WebGL startup.
    let active=true,hasFailure=false,disposeBackground=()=>{};
    const loadBackground=()=>{
      disposeBackground();hasFailure=false;setFailed(false);setLoading(true);
      try{
        const context=document.createElement('canvas').getContext('webgl2');
        if(!context)throw new Error('WebGL2 unavailable');
        context.getExtension('WEBGL_lose_context')?.loseContext();
      }catch{hasFailure=true;setFailed(true);setLoading(false);return;}
      const background=maplibreGL({style:styleUrl,attributionControl:{customAttribution:attribution}});
      let timer:ReturnType<typeof setTimeout>|undefined;
      let disposed=false;
      const markFailed=()=>{if(active&&!disposed){hasFailure=true;clearTimeout(timer);setFailed(true);setLoading(false);}};
      disposeBackground=()=>{disposed=true;clearTimeout(timer);if(map.hasLayer(background))map.removeLayer(background);};
      try{
        background.addTo(map);
        const gl=background.getMaplibreMap();
        gl.on('error',markFailed);
        gl.on('idle',()=>{if(active&&!disposed&&!hasFailure){clearTimeout(timer);setFailed(false);setLoading(false);}});
        timer=setTimeout(markFailed,20_000);
      }catch{
        // The adapter assumes a GL map exists during removal. If WebGL startup
        // failed, remove only its container so retry/unmount still work.
        if(!background.getMaplibreMap())background.onRemove=()=>{background.getContainer()?.remove();return background;};
        markFailed();
      }
    };
    retryTiles.current=loadBackground;
    const reconnect=()=>{if(hasFailure)loadBackground();};
    window.addEventListener('online',reconnect);
    loadBackground();
    const observer=new ResizeObserver(()=>{if(active)map.invalidateSize();});observer.observe(element.current);
    return()=>{active=false;observer.disconnect();window.removeEventListener('online',reconnect);retryTiles.current=()=>{};disposeBackground();map.stop();map.remove();mapRef.current=null;};
  },[]);
  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    const layer=L.layerGroup().addTo(map);
    const points: L.LatLngTuple[]=[];
    for(const area of areas){const p=places[area.key];if(!p)continue;const point: L.LatLngTuple=[p.latitude,p.longitude];points.push(point);
      const content=document.createElement('div');const title=document.createElement('strong');title.textContent=area.name;content.append(title);
      const summary=document.createElement('p');summary.textContent=area.requests.length+(supply?' lô hàng':' nhu cầu')+' · Điểm đại diện tỉnh';content.append(summary);
      const action=document.createElement('button');action.type='button';action.textContent='Xem danh sách tại '+area.name;action.addEventListener('click',()=>onSelect(area.key));content.append(action);
      L.circleMarker(point,{radius:Math.min(65,18+Math.sqrt(area.requests.length)*8),color:'#1d7049',weight:1,fillColor:'#278757',fillOpacity:.2}).addTo(layer);
      L.marker(point,{keyboard:true,title:'Khu vực '+area.name,alt:'Khu vực '+area.name,icon:L.divIcon({className:'buying-area-marker',html:'<span>'+area.requests.length+'</span>',iconSize:[34,34],iconAnchor:[17,17]})}).addTo(layer).bindPopup(content);
    }
    if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[30,30],maxZoom:9,animate:false});
    return()=>{layer.remove();};
  },[areas,places,onSelect,supply]);
  return <><div ref={element} className="buying-area-map" role="region" aria-label={supply?'Bản đồ mật độ nguồn cung':'Bản đồ khu vực thu mua'} aria-busy={loading} />{failed&&<div className="row"><p role="status">Không tải được một phần nền bản đồ. Danh sách nhu cầu bên dưới vẫn sử dụng được.</p><button className="button outline" onClick={()=>retryTiles.current()}>Thử lại nền bản đồ</button></div>}</>;
}
