// @a11y-strict
// client/src/components/layout/NotificationBell.tsx — notification inbox popover
// Session 12 · Wave 4 · No enum, no namespace, no default export
// Session 49 · Build 5 · wave 5-1: popover (S0) instead of a sheet; Databricks
// bell icon; states populated / loading / empty ("You're all caught up") /
// error (muted dot + "Notifications unavailable" tooltip, still focusable);
// Escape closes and returns focus to the bell (KB K6). Offline disables
// "Mark all read". `notificationActions` is the slot for per-item actions
// (session 56 mounts "Share to Slack" there).

import { useCallback, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import type { Notification } from '../../../../shared/contracts';
import {
  useMarkNotificationsRead,
  useNotifications,
  useUnreadCount,
} from '../../lib/api/hooks';
import { formatRelativeTime } from '../../lib/time';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { cn } from '../../lib/utils';
import { Icon } from '../ui/Icon';
import { InlineAlert } from '../ui/InlineAlert';
import { SkeletonGroup } from '../ui/Skeleton';
import { ShellPopover } from './ShellPopover';

export interface NotificationBellProps {
  /** Per-notification actions rendered under each item (session 56: Share to Slack). */
  notificationActions?: (notification: Notification) => ReactNode;
}

export const BELL_UNAVAILABLE = 'Notifications unavailable';

/** Accessible name of the bell: "Notifications (2 unread)". */
export function bellLabel(count: number | undefined, failed: boolean): string {
  if (failed) return BELL_UNAVAILABLE;
  return count === undefined ? 'Notifications' : `Notifications (${count} unread)`;
}

export function NotificationBell({ notificationActions }: NotificationBellProps = {}) {
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const tooltipId = useId();
  const online = useOnlineStatus();

  const unread = useUnreadCount();
  const list = useNotifications({ limit: 20 }, { enabled: open });
  const markRead = useMarkNotificationsRead();

  const failed = unread.isError;
  const count = unread.data?.count;
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="group relative">
      <button
        ref={bellRef}
        type="button"
        data-testid="shell-bell-button"
        aria-label={bellLabel(count, failed)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-describedby={failed ? tooltipId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-11 min-w-11 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Icon name="bell" size={20} />
        {failed ? (
          <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-background bg-muted-foreground" />
        ) : count ? (
          <span
            aria-hidden="true"
            data-testid="shell-bell-count"
            className="absolute right-0 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-bold text-primary-foreground"
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>
      {failed ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute right-0 top-12 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {BELL_UNAVAILABLE}
        </span>
      ) : null}

      <ShellPopover
        id={popoverId}
        open={open}
        onClose={close}
        triggerRef={bellRef}
        label="Notifications"
        data-testid="shell-notifications-popover"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-base font-bold">Notifications</h2>
          {count ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markRead.mutate({ ids: 'all' })}
              disabled={markRead.isPending || !online}
            >
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {list.isPending ? (
            <SkeletonGroup label="Loading notifications" lines={3} className="p-5" />
          ) : list.isError ? (
            <div className="p-4">
              <InlineAlert title={BELL_UNAVAILABLE} onRetry={() => void list.refetch()} retrying={list.isFetching}>
                {list.error.message}
              </InlineAlert>
            </div>
          ) : list.data.length === 0 ? (
            <div className="px-6 py-10 text-center" data-testid="shell-notifications-empty">
              <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-muted text-success">
                <Icon name="check" size={20} />
              </span>
              <p className="font-bold">You're all caught up</p>
              <p className="mt-1.5 text-sm text-muted-foreground">New activity will appear here.</p>
            </div>
          ) : (
            <ul aria-label="Recent notifications">
              {list.data.map((n) => (
                <li
                  key={n.id}
                  data-testid="shell-notification-item"
                  data-notification-id={n.id}
                  data-unread={n.readAt ? undefined : 'true'}
                  className={cn('flex gap-3 border-b border-border px-5 py-4', !n.readAt && 'bg-muted/50')}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                    <Icon name={n.eventType.startsWith('feedback.') ? 'branch' : 'bell'} size={16} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-sm font-bold">
                      {n.title}
                      {!n.readAt ? <span className="sr-only"> (unread)</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={n.createdAt}>{formatRelativeTime(n.createdAt)}</time>
                    </p>
                    {notificationActions ? <div className="mt-1 flex gap-2">{notificationActions(n)}</div> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ShellPopover>
    </div>
  );
}
