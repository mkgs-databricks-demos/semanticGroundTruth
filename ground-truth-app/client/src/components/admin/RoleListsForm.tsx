// client/src/components/admin/RoleListsForm.tsx — admin + steward email list management
// Session 13 · Wave 4 · No enum, no namespace, no default export

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Textarea,
} from '@databricks/appkit-ui/react';
import { useAdminConfig, useUpdateAdminConfig } from '../../lib/api';

export function RoleListsForm() {
  const { data: config, isLoading, error } = useAdminConfig();
  const update = useUpdateAdminConfig();
  const [adminEmails, setAdminEmails] = useState('');
  const [stewardEmails, setStewardEmails] = useState('');

  useEffect(() => {
    if (config) {
      setAdminEmails((config.adminEmails ?? []).join('\n'));
      setStewardEmails((config.stewardEmails ?? []).join('\n'));
    }
  }, [config]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Role Lists</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Role Lists</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  function parseEmails(raw: string): string[] {
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      adminEmails: parseEmails(adminEmails),
      stewardEmails: parseEmails(stewardEmails),
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Role Lists</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Admin Emails</span>
            <Textarea
              value={adminEmails}
              onChange={(e) => setAdminEmails(e.target.value)}
              placeholder="one email per line"
              rows={4}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Steward Emails</span>
            <Textarea
              value={stewardEmails}
              onChange={(e) => setStewardEmails(e.target.value)}
              placeholder="one email per line"
              rows={4}
            />
          </label>

          {update.error && (
            <p className="text-sm text-destructive">{update.error.message}</p>
          )}

          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save Role Lists'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
