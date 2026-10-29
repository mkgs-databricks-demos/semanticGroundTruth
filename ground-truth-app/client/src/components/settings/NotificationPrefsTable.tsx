// @a11y-strict
// client/src/components/settings/NotificationPrefsTable.tsx — per-user notification preferences
// Session 52 · Build 5 · wave 5-2 (S7 Notifications; F8: moved here from the admin-only page)
//
// One row per event type. In-app and Daily digest are switches. Slack, Teams
// and webhook delivery are deferred (G5), so those cells show a disabled
// switch with the stored value and the column header says "Coming later".
// The Slack *share* action lives on notifications and assets, not here.

import type { NotificationChannel, NotificationEventType } from '../../../../shared/contracts';
import { CHANNEL_LABELS, COMING_LATER_CHANNELS, EVENT_LABELS, type PrefRow } from './settingsForm';
import { SettingsSwitch } from './SettingsSwitch';

export interface NotificationPrefsTableProps {
  rows: readonly PrefRow[];
  onToggleChannel: (eventType: NotificationEventType, channel: NotificationChannel) => void;
  onToggleDigest: (eventType: NotificationEventType) => void;
  disabled?: boolean;
}

export function NotificationPrefsTable({ rows, onToggleChannel, onToggleDigest, disabled = false }: NotificationPrefsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="sr-only">Notification preferences by event</caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="py-2 pr-4 font-medium">Event</th>
            <th scope="col" className="px-2 py-2 font-medium">{CHANNEL_LABELS.in_app}</th>
            {COMING_LATER_CHANNELS.map((channel) => (
              <th key={channel} scope="col" className="px-2 py-2 font-medium">
                <span className="flex flex-col">
                  <span>{CHANNEL_LABELS[channel]}</span>
                  <span className="text-xs font-normal text-muted-foreground">Coming later</span>
                </span>
              </th>
            ))}
            <th scope="col" className="px-2 py-2 font-medium">Daily digest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const label = EVENT_LABELS[row.eventType];
            return (
              <tr
                key={row.eventType}
                data-testid="settings-notifications-row"
                data-event-type={row.eventType}
                className="border-b border-border last:border-b-0"
              >
                <th scope="row" className="py-1 pr-4 text-left font-medium">{label}</th>
                <td className="px-2 py-1">
                  <SettingsSwitch
                    hideLabel
                    label={`${label}: in-app`}
                    checked={row.channels.includes('in_app')}
                    disabled={disabled}
                    onChange={() => onToggleChannel(row.eventType, 'in_app')}
                  />
                </td>
                {COMING_LATER_CHANNELS.map((channel) => (
                  <td key={channel} className="px-2 py-1">
                    <SettingsSwitch
                      hideLabel
                      label={`${label}: ${CHANNEL_LABELS[channel]} (coming later)`}
                      checked={row.channels.includes(channel)}
                      disabled
                      onChange={() => undefined}
                    />
                  </td>
                ))}
                <td className="px-2 py-1">
                  <SettingsSwitch
                    hideLabel
                    label={`${label}: daily digest`}
                    checked={row.digest}
                    disabled={disabled}
                    onChange={() => onToggleDigest(row.eventType)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
