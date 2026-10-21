// client/src/pages/admin/AdminPage.tsx — admin-gated configuration page
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
import { ScoringConfigForm } from '../../components/admin/ScoringConfigForm';
import { RoleListsForm } from '../../components/admin/RoleListsForm';
import { MaintenanceActions } from '../../components/admin/MaintenanceActions';
import { NotificationPrefsForm } from '../../components/admin/NotificationPrefsForm';

export function AdminPage() {
  const me = useMe();

  if (me.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasRole(me.data, 'admin')) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <Card>
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ShieldAlert className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Admin Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This page is restricted to administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold">Admin Settings</h2>
      <ScoringConfigForm />
      <RoleListsForm />
      <MaintenanceActions />
      <NotificationPrefsForm />
    </div>
  );
}
