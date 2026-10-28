// @a11y-strict
// client/src/components/access/RoleGate.tsx — shared access gate for role-gated pages (F4)
// Session 54 · Build 5 · wave 5-2 (screen_inventory.md F4, S4-S6)
//
// Steward, Executive and Admin used to show "Access Required" when
// GET /api/me failed. The gate keeps the four cases apart:
//   loading    GET /api/me pending  → page title + skeleton (role="status")
//   error      GET /api/me failed   → page title + alert with Retry
//   forbidden  role too low         → `<page>-forbidden-root`
//   allowed                         → children
// Children mount only when allowed, so a forbidden or failed check sends no
// page requests.

import type { ReactNode } from 'react';
import type { Role } from '../../../../shared/contracts';
import { useMe } from '../../lib/api';
import { hasRole } from '../../lib/api/roles';
import { EmptyPanel, InlineAlert, SkeletonGroup } from '../ui';

export type GatedPage = 'steward' | 'executive' | 'admin';

/** Test ids per page (literal strings, ui_test_strategy.md §3). */
export const ROLE_GATE_TEST_IDS = {
  steward: { loading: 'steward-access-loading', error: 'steward-access-error', forbidden: 'steward-forbidden-root' },
  executive: { loading: 'executive-access-loading', error: 'executive-access-error', forbidden: 'executive-forbidden-root' },
  admin: { loading: 'admin-access-loading', error: 'admin-access-error', forbidden: 'admin-forbidden-root' },
} as const satisfies Record<GatedPage, { loading: string; error: string; forbidden: string }>;

export const ACCESS_ERROR_TITLE = "We couldn't check your access";

export interface RoleGateProps {
  page: GatedPage;
  /** Minimum role (admin > steward > reviewer). */
  role: Role;
  /** Page title, rendered as the <h1> while the gate is not open. */
  title: string;
  forbiddenTitle: string;
  forbiddenDescription: string;
  children: ReactNode;
}

export function RoleGate({ page, role, title, forbiddenTitle, forbiddenDescription, children }: RoleGateProps) {
  const me = useMe();
  const ids = ROLE_GATE_TEST_IDS[page];

  if (me.isPending) {
    return (
      <GateFrame title={title}>
        <div data-testid={ids.loading}>
          <SkeletonGroup label="Checking your access" lines={4} />
        </div>
      </GateFrame>
    );
  }

  if (me.isError) {
    return (
      <GateFrame title={title}>
        <div data-testid={ids.error}>
          <InlineAlert title={ACCESS_ERROR_TITLE} onRetry={() => void me.refetch()} retrying={me.isFetching}>
            {me.error.message || 'The access check failed. Try again in a moment.'}
          </InlineAlert>
        </div>
      </GateFrame>
    );
  }

  if (!hasRole(me.data, role)) {
    return (
      <GateFrame title={title}>
        <div data-testid={ids.forbidden} className="mx-auto mt-8 max-w-md">
          <EmptyPanel illustration="governance" title={forbiddenTitle} description={forbiddenDescription} />
        </div>
      </GateFrame>
    );
  }

  return <>{children}</>;
}

function GateFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}
