// @a11y-strict
// client/src/components/share/ShareToSlackButton.tsx — "Share to Slack" action
// Session 56 · Build 5 · wave 5-3 (G5 Option A). Brand SendIcon (session 42
// manifest). The visible text is "Share to Slack"; `subject` is appended for
// screen readers so several buttons in one list have distinct names (the
// visible label stays at the start of the name, WCAG 2.5.3).

import { forwardRef } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import { cn } from '../../lib/utils';
import { Icon } from '../ui/Icon';

export const SHARE_TO_SLACK_LABEL = 'Share to Slack';

export interface ShareToSlackButtonProps {
  onClick: () => void;
  /** What is shared, e.g. the notification title (screen-reader suffix). */
  subject?: string;
  disabled?: boolean;
  size?: 'sm' | 'default';
  className?: string;
  /** ui_test_strategy.md §3 test id of the caller, e.g. shell-notification-share-button. */
  testId?: string;
}

export const ShareToSlackButton = forwardRef<HTMLButtonElement, ShareToSlackButtonProps>(function ShareToSlackButton(
  { onClick, subject, disabled = false, size = 'sm', className, testId },
  ref,
) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size={size}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn('min-h-[44px] gap-2', className)}
    >
      <Icon name="send" size={16} />
      {SHARE_TO_SLACK_LABEL}
      {subject ? <span className="sr-only">{`: ${subject}`}</span> : null}
    </Button>
  );
});
