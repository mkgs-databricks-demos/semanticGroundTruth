// client/src/pages/executive/ExecutivePage.tsx — steward-gated executive summary
// Session 13 · Wave 4 · No enum, no namespace, no default export

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { ShieldAlert } from 'lucide-react';
import { useMe } from '../../lib/api';
import { hasRole } from '../../lib/api/roles';
import { KpiCards } from '../../components/executive/KpiCards';
import { DashboardLink } from '../../components/executive/DashboardLink';

export function ExecutivePage() {
  const me = useMe();

  if (me.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!hasRole(me.data, 'steward')) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <Card>
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ShieldAlert className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Steward Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The executive dashboard is available to stewards and administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h2 className="text-2xl font-bold">Executive Summary</h2>
      <KpiCards />
      <DashboardLink />
    </div>
  );
}
