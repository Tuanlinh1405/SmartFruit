import { useId, useState } from 'react';
import type { LotCatalog } from '../../features/farmer/lots/lot.model';
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
export function FruitCombobox({ catalog, fruitId, varietyId, error, onChange }: { catalog:LotCatalog;fruitId:string;varietyId:string;error?:string;onChange:(fruit:string,variety:string)=>void }) {
  const id=useId();
  const options=catalog.fruits.filter(f=>f.active||f.id===fruitId).flatMap(f=>[{id:f.id,fruit:f.id,variety:'',name:f.name,active:f.active},...catalog.varieties.filter(v=>v.fruit_type_id===f.id&&(v.active||v.id===varietyId)).map(v=>({id:v.id,fruit:f.id,variety:v.id,name:`${f.name} · ${v.name}`,active:f.active&&v.active}))]);
  const selected=options.find(o=>o.fruit===fruitId&&o.variety===varietyId);
  const [text,setText]=useState(selected?.name??''),[open,setOpen]=useState(false),[index,setIndex]=useState(0);
  const matches=options.filter(o=>normalize(o.name).includes(normalize(text))).slice(0,30);
  const choose=(o:typeof options[number])=>{if(!o.active)return;setText(o.name);onChange(o.fruit,o.variety);setOpen(false);};
  return <div className="field fruit-combobox"><label className="field-label" htmlFor={id}>Loại quả / giống <span aria-hidden="true">*</span></label>
    <input id={id} className="control" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open&&matches[index]?`${id}-${index}`:undefined} aria-invalid={!!error} aria-describedby={`${id}-hint`} required value={text} placeholder="Gõ sầu riêng, Ri6, mít…" onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onChange={e=>{setText(e.target.value);setIndex(0);setOpen(true);onChange('','');}} onKeyDown={e=>{
      if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setIndex(i=>Math.min(i+1,matches.length-1));}
      if(e.key==='ArrowUp'){e.preventDefault();setIndex(i=>Math.max(0,i-1));}
      if(e.key==='Escape')setOpen(false);
      if(e.key==='Enter'&&open){e.preventDefault();if(matches[index])choose(matches[index]);}
    }}/>
    {open&&<ul id={`${id}-options`} role="listbox" aria-label="Gợi ý loại quả và giống">{matches.map((o,i)=><li role="option" aria-selected={index===i} aria-disabled={!o.active} id={`${id}-${i}`} key={o.id} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(o)}>{o.name}{!o.active&&' (ngừng sử dụng)'}</li>)}{!matches.length&&<li>Không tìm thấy trong danh mục.</li>}</ul>}
    <small id={`${id}-hint`}>{error??'Chọn một loại và giống từ gợi ý. Mỗi lô chỉ gồm một loại quả.'}</small>
  </div>;
}
