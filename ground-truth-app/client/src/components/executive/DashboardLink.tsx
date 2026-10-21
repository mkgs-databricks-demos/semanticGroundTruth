// client/src/components/executive/DashboardLink.tsx — link to external AI/BI dashboard
// Session 13 · Wave 4 · No enum, no namespace, no default export

import { Button } from '@databricks/appkit-ui/react';
import { ExternalLink } from 'lucide-react';

const DASHBOARD_URL = import.meta.env.VITE_EXEC_DASHBOARD_URL as string | undefined;

export function DashboardLink() {
  if (!DASHBOARD_URL) {
    return (
      <p className="text-sm text-muted-foreground">
        Executive dashboard URL not configured. Set <code>VITE_EXEC_DASHBOARD_URL</code> to enable.
      </p>
    );
  }

  return (
    <Button asChild variant="outline">
      <a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="mr-2 h-4 w-4" />
        Open Executive Dashboard
      </a>
    </Button>
  );
}
