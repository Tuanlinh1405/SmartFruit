import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { BuyingArea } from './areas';
import type { Place } from './geography';

export default function AreaMap({ areas, places, onSelect }: { areas: BuyingArea[]; places: Record<string,Place>; onSelect: (key: string)=>void }) {
  const element=useRef<HTMLDivElement>(null),mapRef=useRef<L.Map|null>(null);const [failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!element.current)return;
    const map=L.map(element.current,{scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([16,107],5);mapRef.current=map;
    const tileUrl=import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const tiles=L.tileLayer(tileUrl,{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    tiles.on('tileerror',()=>setFailed(true));
    let active=true;const observer=new ResizeObserver(()=>{if(active)map.invalidateSize();});observer.observe(element.current);
    return()=>{active=false;observer.disconnect();tiles.off();map.stop();map.remove();mapRef.current=null;};
  },[]);
  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    const layer=L.layerGroup().addTo(map);
    const points: L.LatLngTuple[]=[];
    for(const area of areas){const p=places[area.key];if(!p)continue;const point: L.LatLngTuple=[p.latitude,p.longitude];points.push(point);
      const content=document.createElement('div');const title=document.createElement('strong');title.textContent=area.name;content.append(title);
      const summary=document.createElement('p');summary.textContent=area.requests.length+' nhu cầu · Điểm đại diện khu vực';content.append(summary);
      const action=document.createElement('button');action.type='button';action.textContent='Xem nhu cầu tại '+area.name;action.addEventListener('click',()=>onSelect(area.key));content.append(action);
      L.marker(point,{keyboard:true,title:'Khu vực '+area.name,alt:'Khu vực '+area.name,icon:L.divIcon({className:'buying-area-marker',html:'<span>'+area.requests.length+'</span>',iconSize:[34,34],iconAnchor:[17,17]})}).addTo(layer).bindPopup(content);
    }
    if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[30,30],maxZoom:9,animate:false});
    return()=>{layer.remove();};
  },[areas,places,onSelect]);
  return <><div ref={element} className="buying-area-map" role="region" aria-label="Bản đồ khu vực thu mua" />{failed&&<p role="status">Không tải được một phần nền bản đồ. Danh sách nhu cầu bên dưới vẫn sử dụng được.</p>}</>;
}
