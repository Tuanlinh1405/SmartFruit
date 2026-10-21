import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Drawer } from '../components/ui/dialog';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  return <Drawer title="Thông báo" description="Cập nhật về hoạt động và tài khoản của bạn." open={open} onOpenChange={setOpen}
    trigger={<Button variant="ghost" className="workspace-notification-bell" aria-label="Mở thông báo"><Bell size={20} aria-hidden="true" /></Button>}>
    <div className="notification-empty"><Bell size={32} aria-hidden="true" /><h3>Chưa có thông báo</h3><p>Thông báo mới sẽ xuất hiện tại đây.</p></div>
  </Drawer>;
}
