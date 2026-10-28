// @a11y-strict
// client/src/pages/admin/AdminPage.tsx — admin-gated configuration page (S6)
// Session 13 · Wave 4 · No enum, no namespace, no default export
// Session 54 · Build 5 · wave 5-2: RoleGate (F4); three groups (Members and
// roles, Scoring, System); notification preferences removed (they live on
// Settings, F8); forms disabled offline.

import { useId } from 'react';
import type { ReactNode } from 'react';
import { RoleGate } from '../../components/access/RoleGate';
import { MaintenanceActions } from '../../components/admin/MaintenanceActions';
import { MembersPanel } from '../../components/admin/MembersPanel';
import { RoleListsForm } from '../../components/admin/RoleListsForm';
import { ScoringConfigForm } from '../../components/admin/ScoringConfigForm';
import { InlineAlert } from '../../components/ui';
import { useOnlineStatus } from '../../lib/useOnlineStatus';

export const ADMIN_TITLE = 'Admin';
export const ADMIN_FORBIDDEN_TITLE = 'Admin access required';
export const ADMIN_FORBIDDEN_TEXT = 'Ask an admin to add you to semantic-ground-truth-admins.';

export function AdminPage() {
  return (
    <RoleGate
      page="admin"
      role="admin"
      title={ADMIN_TITLE}
      forbiddenTitle={ADMIN_FORBIDDEN_TITLE}
      forbiddenDescription={ADMIN_FORBIDDEN_TEXT}
    >
      <AdminContent />
    </RoleGate>
  );
}

function AdminContent() {
  const online = useOnlineStatus();
  const disabled = !online;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold">{ADMIN_TITLE}</h1>

      {!online ? (
        <InlineAlert variant="offline" title="You're offline">
          Changes are disabled until the connection is back.
        </InlineAlert>
      ) : null}

      <AdminGroup title="Members and roles" description="Who can review, steward and administer the app.">
        <MembersPanel disabled={disabled} />
        <h3 className="text-sm font-bold">Role lists</h3>
        <RoleListsForm />
      </AdminGroup>

      <AdminGroup title="Scoring" description="How confidence and certification are calculated.">
        <ScoringConfigForm disabled={disabled} />
      </AdminGroup>

      <AdminGroup title="System" description="Maintenance actions. Each one asks for confirmation.">
        <MaintenanceActions disabled={disabled} />
      </AdminGroup>
    </div>
  );
}

function AdminGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-lg font-bold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
