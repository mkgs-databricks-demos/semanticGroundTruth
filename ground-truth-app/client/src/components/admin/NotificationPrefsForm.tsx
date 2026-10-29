// @a11y-strict
// client/src/components/admin/NotificationPrefsForm.tsx — notification preferences editor
// Session 13 · Wave 4 · No enum, no namespace, no default export

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import type { NotificationChannel, NotificationEventType } from '../../../../shared/contracts';
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENT_TYPES } from '../../../../shared/contracts';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../../lib/api';
import { useEffect, useState } from 'react';

interface PrefRow {
  eventType: NotificationEventType;
  channels: NotificationChannel[];
  digest: boolean;
}

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: 'In-App',
  slack: 'Slack',
  teams: 'Teams',
  webhook: 'Webhook',
};

export function NotificationPrefsForm() {
  const { data, isLoading, error } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [rows, setRows] = useState<PrefRow[]>([]);

  useEffect(() => {
    if (data) {
      // Ensure every event type has a row
      const existing = new Map(data.map((p) => [p.eventType, p]));
      const merged: PrefRow[] = (NOTIFICATION_EVENT_TYPES as readonly NotificationEventType[]).map(
        (et) => existing.get(et) ?? { eventType: et, channels: ['in_app'], digest: false },
      );
      setRows(merged);
    }
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  function toggleChannel(eventType: NotificationEventType, channel: NotificationChannel) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.eventType !== eventType) return r;
        const has = r.channels.includes(channel);
        return {
          ...r,
          channels: has
            ? r.channels.filter((c) => c !== channel)
            : [...r.channels, channel],
        };
      }),
    );
  }

  function toggleDigest(eventType: NotificationEventType) {
    setRows((prev) =>
      prev.map((r) =>
        r.eventType === eventType ? { ...r, digest: !r.digest } : r,
      ),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({ preferences: rows });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Notification Preferences</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.eventType} className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">{row.eventType}</p>
                <div className="flex flex-wrap gap-3">
                  {(NOTIFICATION_CHANNELS as readonly NotificationChannel[]).map((ch) => (
                    <label key={ch} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={row.channels.includes(ch)}
                        onChange={() => toggleChannel(row.eventType, ch)}
                        className="rounded border-input"
                      />
                      {CHANNEL_LABELS[ch]}
                    </label>
                  ))}
                  <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.digest}
                      onChange={() => toggleDigest(row.eventType)}
                      className="rounded border-input"
                    />
                    Digest
                  </label>
                </div>
              </div>
            ))}
          </div>

          {update.error && (
            <p className="text-sm text-destructive">{update.error.message}</p>
          )}

          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save Preferences'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
