// client/src/components/admin/MembersPanel.tsx — app group membership management
// Session 10 · Wave 1 · No enum, no namespace, no default export

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import {
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import type { AppGroup, AppGroupMember } from '../../../../../shared/contracts';
import { APP_GROUP_ROLE } from '../../../../../shared/contracts';
import type { AppGroupName } from '../../../../../shared/contracts';
import {
  useAdminGroups,
  useAddGroupMember,
  useRemoveGroupMember,
} from '../../lib/api/hooks';
import type { ApiError } from '../../lib/api/http';

const ROLE_COLOR: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  steward: 'secondary',
  reviewer: 'outline',
};

export function MembersPanel() {
  const groupsQ = useAdminGroups();
  const addM = useAddGroupMember();
  const removeM = useRemoveGroupMember();

  const [addingTo, setAddingTo] = useState<AppGroupName | null>(null);
  const [newMemberId, setNewMemberId] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<{
    group: AppGroupName;
    memberId: string;
  } | null>(null);

  const mutError = addM.error ?? removeM.error;

  async function handleAdd(groupName: AppGroupName) {
    if (!newMemberId.trim()) return;
    await addM.mutateAsync({
      groupName,
      body: { memberId: newMemberId.trim().toLowerCase() },
    });
    setNewMemberId('');
    setAddingTo(null);
  }

  async function handleRemove(groupName: AppGroupName, memberId: string) {
    await removeM.mutateAsync({ groupName, memberId });
    setConfirmRemove(null);
  }

  if (groupsQ.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  const groups: AppGroup[] = groupsQ.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Members
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error banner */}
        {mutError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{(mutError as ApiError | Error).message}</span>
          </div>
        )}

        {groups.map((group) => (
          <GroupSection
            key={group.name}
            group={group}
            isAdding={addingTo === group.name}
            newMemberId={addingTo === group.name ? newMemberId : ''}
            confirmRemove={
              confirmRemove?.group === group.name ? confirmRemove.memberId : null
            }
            isAddPending={addM.isPending}
            isRemovePending={removeM.isPending}
            onStartAdd={() => {
              setAddingTo(group.name);
              setNewMemberId('');
            }}
            onCancelAdd={() => setAddingTo(null)}
            onMemberIdChange={setNewMemberId}
            onAdd={() => void handleAdd(group.name)}
            onConfirmRemove={(memberId) =>
              setConfirmRemove({ group: group.name, memberId })
            }
            onCancelRemove={() => setConfirmRemove(null)}
            onRemove={(memberId) => void handleRemove(group.name, memberId)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ── GroupSection ────────────────────────────────────────────────────────

interface GroupSectionProps {
  group: AppGroup;
  isAdding: boolean;
  newMemberId: string;
  confirmRemove: string | null;
  isAddPending: boolean;
  isRemovePending: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onMemberIdChange: (v: string) => void;
  onAdd: () => void;
  onConfirmRemove: (memberId: string) => void;
  onCancelRemove: () => void;
  onRemove: (memberId: string) => void;
}

function GroupSection({
  group,
  isAdding,
  newMemberId,
  confirmRemove,
  isAddPending,
  isRemovePending,
  onStartAdd,
  onCancelAdd,
  onMemberIdChange,
  onAdd,
  onConfirmRemove,
  onCancelRemove,
  onRemove,
}: GroupSectionProps) {
  const role = APP_GROUP_ROLE[group.name];
  const colorVariant = ROLE_COLOR[role] ?? 'outline';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{group.name}</span>
          <Badge variant={colorVariant}>{role}</Badge>
          {group.description && (
            <span className="text-xs text-muted-foreground">
              {group.description}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onStartAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {/* Add member form */}
      {isAdding && (
        <div className="flex gap-2 mb-2">
          <Input
            value={newMemberId}
            onChange={(e) => onMemberIdChange(e.target.value)}
            placeholder="Email or SPN application ID"
            className="flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
          />
          <Button
            size="sm"
            onClick={onAdd}
            disabled={!newMemberId.trim() || isAddPending}
          >
            {isAddPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Add'
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelAdd}>
            Cancel
          </Button>
        </div>
      )}

      {/* Member table */}
      {group.members.length === 0 ? (
        <p className="text-sm text-muted-foreground pl-2">No members.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Added by</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.members.map((m: AppGroupMember) => (
              <TableRow key={m.memberId}>
                <TableCell className="font-medium">{m.memberId}</TableCell>
                <TableCell className="text-muted-foreground">
                  {m.addedBy}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(m.addedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {confirmRemove === m.memberId ? (
                    <div className="flex gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onRemove(m.memberId)}
                        disabled={isRemovePending}
                      >
                        {isRemovePending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Confirm'
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancelRemove}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onConfirmRemove(m.memberId)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
