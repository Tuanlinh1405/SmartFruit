import {useEffect,useState} from 'react';
import {ImageOff} from 'lucide-react';
export interface ProductPhotoData {url:string;is_ai_generated:boolean}
export function ProductPhoto({photo,alt,loading=false,onRetry}:{photo?:ProductPhotoData;alt:string;loading?:boolean;onRetry?:()=>void}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[photo?.url]);
 return <figure className="product-photo" aria-busy={loading}>
  {photo&&!failed?<img src={photo.url} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>:<div className="product-photo-fallback"><ImageOff size={20} aria-hidden="true"/><span>{loading?'Đang tải ảnh…':'Chưa tải được ảnh'}</span>{onRetry&&!loading&&<button type="button" onClick={onRetry}>Tải lại ảnh</button>}</div>}
  {photo?.is_ai_generated&&<figcaption>Ảnh minh họa AI</figcaption>}
 </figure>;
}
