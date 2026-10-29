// @a11y-strict
// client/src/pages/executive/ExecutivePage.tsx — steward-gated executive summary (S5)
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2: RoleGate (F4), 6 KPI groups, empty
// (`totalAssets 0`), dashboard-unconfigured, error with Retry, offline note.

import { Link } from 'react-router';
import { Button } from '@databricks/appkit-ui/react';
import { RoleGate } from '../../components/access/RoleGate';
import { DashboardLink } from '../../components/executive/DashboardLink';
import { KpiCards, KpiSkeletons } from '../../components/executive/KpiCards';
import { EmptyPanel, InlineAlert } from '../../components/ui';
import { useExecutiveSummary } from '../../lib/api';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

export const EXECUTIVE_TITLE = 'Executive summary';
export const STEWARD_FORBIDDEN_TITLE = 'Steward access required';
export const STEWARD_FORBIDDEN_TEXT = 'Ask an admin to add you to semantic-ground-truth-stewards.';

export function ExecutivePage() {
  return (
    <RoleGate
      page="executive"
      role="steward"
      title={EXECUTIVE_TITLE}
      forbiddenTitle={STEWARD_FORBIDDEN_TITLE}
      forbiddenDescription={STEWARD_FORBIDDEN_TEXT}
    >
      <ExecutiveContent />
    </RoleGate>
  );
}

function ExecutiveContent() {
  const summary = useExecutiveSummary();
  const online = useOnlineStatus();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{EXECUTIVE_TITLE}</h1>
        <p className="text-sm text-muted-foreground">Semantic asset coverage and certification</p>
      </header>

      {!online ? (
        <InlineAlert variant="offline" title="You're offline">
          These figures may be out of date. They refresh when the connection is back.
        </InlineAlert>
      ) : null}

      {summary.isPending ? (
        <KpiSkeletons />
      ) : summary.isError ? (
        <div data-testid="executive-error">
          <InlineAlert
            title="Couldn't load the executive summary"
            onRetry={() => void summary.refetch()}
            retrying={summary.isFetching}
          >
            {summary.error.message}
          </InlineAlert>
        </div>
      ) : summary.data.totalAssets === 0 ? (
        <div data-testid="executive-empty-root">
          <EmptyPanel
            illustration="dashboards"
            title="No assets yet"
            description="Import metric views or glossary terms in the Steward console to start tracking coverage."
            action={
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link to="/steward">Import assets</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <KpiCards summary={summary.data} />
      )}

      <DashboardLink />
    </div>
  );
}
