// @a11y-strict
// client/src/components/layout/OfflineBanner.tsx — "You're offline" status under the header
// Session 49 · Build 5 · wave 5-1 (screen_inventory.md S0 offline state).
// role="status" (polite): announced when it appears, never steals focus.
// The live region stays mounted so the announcement is reliable.

import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { Icon } from '../ui/Icon';

export const OFFLINE_MESSAGE = 'Votes and edits are paused until the connection is back.';

export function OfflineBanner() {
  const online = useOnlineStatus();
  return (
    <div role="status" data-testid="shell-offline-banner" data-offline={online ? undefined : 'true'}>
      {online ? null : (
        <p className="flex min-h-11 items-center justify-center gap-2 border-b border-border bg-warning px-4 py-2 text-sm text-warning-foreground">
          <Icon name="cloudOff" size={16} />
          <span>
            <strong>You're offline.</strong> {OFFLINE_MESSAGE}
          </span>
        </p>
      )}
    </div>
  );
}
