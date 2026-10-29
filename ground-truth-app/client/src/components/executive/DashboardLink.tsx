// @a11y-strict
// client/src/components/executive/DashboardLink.tsx — link to external AI/BI dashboard
// Session 17 · Wave 1 · reads URL from /api/config, no VITE env var
// Session 54 · Build 5 · wave 5-2: "Detailed dashboard" card (brief S5). The
// link name says it opens in a new tab; `executive_dashboard_url: null` shows
// a muted note and no link (dashboard-unconfigured).

import { useId } from 'react';
import { Button } from '@databricks/appkit-ui/react';
import { useRuntimeConfig } from '../../lib/api/hooks';
import { Icon, InlineAlert, Skeleton } from '../ui';

export const DASHBOARD_LINK_NAME = 'Open AI/BI dashboard (opens in a new tab)';
export const DASHBOARD_UNCONFIGURED_TEXT = "The dashboard link isn't configured for this environment.";

export function DashboardLink() {
  const headingId = useId();
  const config = useRuntimeConfig();
  const url = config.data?.executive_dashboard_url ?? null;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <h2 id={headingId} className="text-lg font-bold">
        Detailed dashboard
      </h2>
      {config.isPending ? (
        <Skeleton className="h-11 w-56" />
      ) : config.isError ? (
        <InlineAlert
          title="Couldn't load the dashboard link"
          onRetry={() => void config.refetch()}
          retrying={config.isFetching}
        >
          {config.error.message}
        </InlineAlert>
      ) : !url ? (
        <p data-testid="executive-dashboard-unconfigured" className="text-sm text-muted-foreground">
          {DASHBOARD_UNCONFIGURED_TEXT}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Review activity, skips and certification trends over time in the AI/BI dashboard.
          </p>
          <div>
            <Button asChild variant="outline" className="min-h-[44px] gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={DASHBOARD_LINK_NAME}
                data-testid="executive-dashboard-link"
              >
                <Icon name="external" />
                Open AI/BI dashboard
              </a>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
