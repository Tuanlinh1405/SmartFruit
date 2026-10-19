import { useId, useRef, type ReactNode } from 'react';
export function Tabs({ items, value, onChange, label }: { items: { value: string; label: string; content: ReactNode }[]; value: string; onChange: (value: string) => void; label: string }) {
  const id = useId(); const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return <div><div role="tablist" aria-label={label} className="tabs-list">{items.map((item, index) => <button key={item.value} ref={element => { refs.current[index] = element; }} type="button" className="tab" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={value === item.value} tabIndex={value === item.value ? 0 : -1} onClick={() => onChange(item.value)} onKeyDown={event => {
    const target = event.key === 'ArrowRight' ? (index + 1) % items.length : event.key === 'ArrowLeft' ? (index - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
    if (target >= 0) { event.preventDefault(); onChange(items[target].value); refs.current[target]?.focus(); }
  }}>{item.label}</button>)}</div>{items.map((item, index) => <div key={item.value} role="tabpanel" className="tab-panel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={value !== item.value} tabIndex={0}>{item.content}</div>)}</div>;
}
