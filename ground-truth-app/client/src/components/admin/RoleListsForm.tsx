// @a11y-strict
// client/src/components/admin/RoleListsForm.tsx — legacy admin + steward email lists
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2 (S6, brief "Role lists"): read-only chips.
// Access is managed through the app groups (Members); these lists are only the
// legacy fallback the server still reads.

import { useId } from 'react';
import { useAdminConfig } from '../../lib/api';
import { InlineAlert, SkeletonGroup } from '../ui';

export const ROLE_LISTS_NOTE = 'Kept for compatibility. Manage access in Members.';

export function RoleListsForm() {
  const config = useAdminConfig();

  if (config.isPending) return <SkeletonGroup label="Loading role lists" lines={2} />;

  if (config.isError) {
    return (
      <InlineAlert title="Couldn't load the role lists" onRetry={() => void config.refetch()} retrying={config.isFetching}>
        {config.error.message}
      </InlineAlert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{ROLE_LISTS_NOTE}</p>
      <EmailChips label="Admin emails" emails={config.data.adminEmails ?? []} />
      <EmailChips label="Steward emails" emails={config.data.stewardEmails ?? []} />
    </div>
  );
}

function EmailChips({ label, emails }: { label: string; emails: string[] }) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1">
      <p id={labelId} className="text-sm font-medium">
        {label}
      </p>
      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul aria-labelledby={labelId} className="flex flex-wrap gap-2">
          {emails.map((email) => (
            <li key={email} className="rounded-full border border-border bg-muted px-3 py-1 font-mono text-xs">
              {email}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
