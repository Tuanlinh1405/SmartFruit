import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef, type ReactElement, type ReactNode } from 'react';
import { Button } from './button';
export interface ModalProps { title: string; description: string; trigger?: ReactElement; open?: boolean; onOpenChange?: (open: boolean) => void; children: ReactNode; drawer?: boolean; className?: string; }
export function Modal({ title, description, trigger, open, onOpenChange, children, drawer, className = '' }: ModalProps) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>{trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}<Dialog.Portal><Dialog.Overlay className="overlay" /><Dialog.Content onOpenAutoFocus={() => { previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }} onCloseAutoFocus={event => { if (!trigger && previousFocus.current?.isConnected) { event.preventDefault(); previousFocus.current.focus(); } }} className={`dialog ${drawer ? 'drawer' : ''} ${className}`}><div className="dialog-head"><Dialog.Title asChild><h2>{title}</h2></Dialog.Title><Dialog.Close asChild><Button variant="ghost" aria-label="Đóng"><X size={20} aria-hidden="true" /></Button></Dialog.Close></div><Dialog.Description className="dialog-description">{description}</Dialog.Description>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Drawer(props: Omit<ModalProps, 'drawer'>) { return <Modal {...props} drawer />; }
export function ConfirmDialog({ onConfirm, ...props }: Omit<ModalProps, 'children' | 'drawer'> & { onConfirm: () => void }) {
  return <Modal {...props}><div className="row"><Dialog.Close asChild><Button variant="secondary">Hủy</Button></Dialog.Close><Dialog.Close asChild><Button onClick={onConfirm}>Xác nhận minh họa</Button></Dialog.Close></div></Modal>;
}
