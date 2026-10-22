import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Drawer } from '../components/ui/dialog';
import { ActiveConversationRead, NotificationCenter, useNotifications } from '../features/notifications/NotificationCenter';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notices=useNotifications();const count=notices.data?.unread??0;
  return <><ActiveConversationRead/><Drawer title="Thông báo" description="Cập nhật về hoạt động và tài khoản của bạn." open={open} onOpenChange={setOpen}
    trigger={<Button variant="ghost" className="workspace-notification-bell" aria-label={`Mở thông báo${count?` (${count} chưa đọc)`:''}`}><Bell size={20} aria-hidden="true" />{count>0&&<span className="notification-count">{count>99?'99+':count}</span>}</Button>}>
    <NotificationCenter onNavigate={()=>setOpen(false)}/>
  </Drawer></>;
}
