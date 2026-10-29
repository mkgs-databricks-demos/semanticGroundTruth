// @a11y-strict
// client/src/components/admin/MembersPanel.tsx — app group membership management
// Session 10 · Wave 1 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2 (S6): one section per app group, empty-group
// copy, remove with a confirm alertdialog, last-admin 409 CONFLICT as an inline
// alert, per-group add / remove errors, writes disabled offline.

import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Input } from '@databricks/appkit-ui/react';
import type { AppGroup, AppGroupMember } from '../../../../shared/contracts';
import { APP_GROUP_ROLE } from '../../../../shared/contracts';
import { useAddGroupMember, useAdminGroups, useRemoveGroupMember } from '../../lib/api/hooks';
import { ApiError } from '../../lib/api/http';
import { Badge, Icon, InlineAlert, SkeletonGroup } from '../ui';
import type { BadgeTone } from '../ui';
import { ConfirmDialog } from './ConfirmDialog';

export const EMPTY_GROUP_TEXT = 'No members. Add an email or service principal id.';
export const LAST_ADMIN_MESSAGE = "You can't remove the last admin.";

const ROLE_TONE: Record<string, BadgeTone> = {
  admin: 'info',
  steward: 'success',
  reviewer: 'outline',
};

export function MembersPanel({ disabled = false }: { disabled?: boolean }) {
  const groupsQ = useAdminGroups();

  if (groupsQ.isPending) {
    return <SkeletonGroup label="Loading members" lines={6} />;
  }

  if (groupsQ.isError) {
    return (
      <InlineAlert
        title="Couldn't load members"
        onRetry={() => void groupsQ.refetch()}
        retrying={groupsQ.isFetching}
      >
        {groupsQ.error.message}
      </InlineAlert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groupsQ.data.map((group) => (
        <GroupSection key={group.name} group={group} disabled={disabled} />
      ))}
    </div>
  );
}

function isLastAdminConflict(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'CONFLICT' || error.status === 409);
}

function GroupSection({ group, disabled }: { group: AppGroup; disabled: boolean }) {
  const headingId = useId();
  const inputId = useId();
  const add = useAddGroupMember();
  const remove = useRemoveGroupMember();
  const [memberId, setMemberId] = useState('');
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const role = APP_GROUP_ROLE[group.name] ?? group.role;

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const id = memberId.trim().toLowerCase();
    if (!id || disabled) return;
    add.mutate({ groupName: group.name, body: { memberId: id } }, { onSuccess: () => setMemberId('') });
  }

  function handleRemove() {
    if (!pendingRemove) return;
    remove.mutate({ groupName: group.name, memberId: pendingRemove });
    setPendingRemove(null);
  }

  const lastAdmin = isLastAdminConflict(remove.error);

  return (
    <section
      aria-labelledby={headingId}
      data-testid="admin-members-group"
      data-group={group.name}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="font-mono text-sm font-bold">
          {group.name}
        </h3>
        <Badge tone={ROLE_TONE[role] ?? 'outline'}>{role}</Badge>
        {group.description ? <p className="w-full text-sm text-muted-foreground">{group.description}</p> : null}
      </div>

      {group.members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_GROUP_TEXT}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {group.members.map((m: AppGroupMember) => (
            <li key={m.memberId} className="flex items-center gap-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-sm">{m.memberId}</span>
                <span className="text-xs text-muted-foreground">
                  Added by {m.addedBy} on {new Date(m.addedAt).toLocaleDateString('en-US')}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                aria-label={`Remove ${m.memberId} from ${group.name}`}
                data-testid="admin-members-remove"
                data-member-id={m.memberId}
                disabled={disabled || remove.isPending}
                onClick={() => setPendingRemove(m.memberId)}
              >
                <Icon name="trash" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {remove.isError ? (
        <InlineAlert title={lastAdmin ? LAST_ADMIN_MESSAGE : "Couldn't remove the member"}>
          {lastAdmin ? 'Add another admin first, then remove this one.' : remove.error.message}
        </InlineAlert>
      ) : null}
      {add.isError ? <InlineAlert title="Couldn't add the member">{add.error.message}</InlineAlert> : null}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={inputId} className="text-sm font-medium">
            Add member
          </label>
          <Input
            id={inputId}
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder="Email or service principal id"
            className="font-mono"
            disabled={disabled}
            data-testid="admin-members-add-input"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          className="min-h-[44px] gap-1.5"
          disabled={disabled || !memberId.trim() || add.isPending}
          data-testid="admin-members-add-submit"
        >
          <Icon name="plus" />
          {add.isPending ? 'Adding…' : 'Add'}
        </Button>
      </form>

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title={`Remove ${pendingRemove ?? ''}?`}
        description={`They lose the ${role} role from ${group.name}.`}
        confirmLabel="Remove"
        onConfirm={handleRemove}
      />
    </section>
  );
}
