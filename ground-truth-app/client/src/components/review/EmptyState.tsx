// @a11y-strict
// client/src/components/review/EmptyState.tsx — S1 empty state ("All caught up!")
// Session 12 · Wave 4
// Session 51 · Build 5 · wave 5-2 · EmptyPanel + data-quality-3 illustration (no lucide PartyPopper, F6);
// "Switch campaign" only with a campaign filter, "View leaderboard" always (screen_inventory S1).

import { Button } from '@databricks/appkit-ui/react';
import { Link } from 'react-router';
import { EmptyPanel } from '../ui';

interface EmptyStateProps {
  campaignFiltered: boolean;
  /** Moves focus to the campaign filter. */
  onSwitchCampaign: () => void;
}

export function EmptyState({ campaignFiltered, onSwitchCampaign }: EmptyStateProps) {
  return (
    <div data-testid="review-empty-root">
      <EmptyPanel
        illustration="data-quality-3"
        title="All caught up!"
        description={
          campaignFiltered
            ? "There's nothing waiting for your review in this campaign."
            : "There's nothing waiting for your review right now."
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {campaignFiltered ? (
              <Button variant="outline" className="min-h-[44px]" onClick={onSwitchCampaign}>
                Switch campaign
              </Button>
            ) : null}
            <Link
              to="/leaderboard"
              className="inline-flex min-h-[44px] items-center rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              View leaderboard
            </Link>
          </div>
        }
      />
    </div>
  );
}
