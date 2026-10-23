// client/src/components/executive/DashboardLink.tsx — link to external AI/BI dashboard
// Session 17 · Wave 1 · reads URL from /api/config, no VITE env var

import { Button, Skeleton } from '@databricks/appkit-ui/react';
import { ExternalLink } from 'lucide-react';
import { useRuntimeConfig } from '../../lib/api/hooks';

export function DashboardLink() {
  const { data, isLoading } = useRuntimeConfig();
  const url = data?.executive_dashboard_url;

  if (isLoading) {
    return <Skeleton className="h-9 w-56" />;
  }

  if (!url) {
    return (
      <p className="text-sm text-muted-foreground">
        Executive dashboard URL not configured.
        An admin can set <code className="font-mono text-xs">GT_EXEC_DASHBOARD_URL</code> in the app environment.
      </p>
    );
  }

  return (
    <Button asChild variant="outline">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="mr-2 h-4 w-4" />
        Open Executive Dashboard
      </a>
    </Button>
  );
}
