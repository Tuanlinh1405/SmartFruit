import { createContext, useContext, useState, useEffect, type PropsWithChildren } from 'react';
import { X } from 'lucide-react';
const ToastContext = createContext<((message: string) => void) | null>(null);
export function ToastProvider({ children }: PropsWithChildren) {
  const [notice, setNotice] = useState<{ message: string; id: number }>();
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(undefined), 6000); return () => clearTimeout(timer); }, [notice]);
  return <ToastContext.Provider value={message => setNotice({ message, id: Date.now() })}>{children}<div aria-live="polite" aria-atomic="true">{notice && <div className="toast" role="status"><p>{notice.message}</p><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(undefined)}><X size={18} aria-hidden="true" /></button></div>}</div></ToastContext.Provider>;
}
export function useToast() { const toast = useContext(ToastContext); if (!toast) throw new Error('useToast cần ToastProvider'); return toast; }
