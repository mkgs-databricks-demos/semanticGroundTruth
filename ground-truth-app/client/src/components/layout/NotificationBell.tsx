// client/src/components/layout/NotificationBell.tsx — notification inbox popover
// Session 12 · Wave 4 · No enum, no namespace, no default export

import { useState } from 'react';
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { Bell } from 'lucide-react';
import {
  useMarkNotificationsRead,
  useNotifications,
  useUnreadCount,
} from '../../lib/api/hooks';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unread } = useUnreadCount();
  const { data: notifications, isLoading } = useNotifications({ limit: 20 });
  const markRead = useMarkNotificationsRead();

  const count = unread?.count ?? 0;

  const handleMarkAllRead = () => {
    markRead.mutate({ ids: 'all' });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
            variant="destructive"
          >
            {count > 99 ? '99+' : count}
          </Badge>
        )}
      </Button>
      <SheetContent side="right">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle>Notifications</SheetTitle>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markRead.isPending}
            >
              Mark all read
            </Button>
          )}
        </SheetHeader>
        <div className="mt-4 space-y-3 overflow-y-auto max-h-[70vh]">
          {isLoading && (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          )}
          {!isLoading && (!notifications || notifications.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No notifications yet.
            </p>
          )}
          {notifications?.map((n) => (
            <div
              key={n.id}
              className={`rounded-md border p-3 text-sm ${
                n.readAt ? 'opacity-60' : 'bg-muted/50'
              }`}
            >
              <p className="font-medium">{n.title}</p>
              <p className="text-muted-foreground text-xs mt-1">{n.body}</p>
              <p className="text-muted-foreground text-xs mt-1">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
