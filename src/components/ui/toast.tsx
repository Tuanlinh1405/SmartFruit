import { createContext, useContext, type PropsWithChildren } from 'react';
import { X } from 'lucide-react';
import { Toaster, toast } from 'sonner';
const ToastContext=createContext<((message:string)=>void)|null>(null);
export function ToastProvider({children}:PropsWithChildren) {
  return <ToastContext.Provider value={message=>{toast.custom(id=><div className="toast-card" role="status"><p>{message}</p><button type="button" aria-label="Đóng thông báo" onClick={()=>toast.dismiss(id)}><X size={18} aria-hidden="true"/></button></div>,{duration:6000});}}>{children}<Toaster position="top-right" /></ToastContext.Provider>;
}
export function useToast(){const show=useContext(ToastContext);if(!show)throw new Error('useToast cần ToastProvider');return show;}
