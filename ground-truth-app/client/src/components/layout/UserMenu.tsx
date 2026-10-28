// @a11y-strict
// client/src/components/layout/UserMenu.tsx — account menu (name, email, roles, Settings)
// Session 49 · Build 5 · wave 5-1 (screen_inventory.md S0 "user menu", last in
// the header Tab order). Skeleton until GET /api/me resolves.

import { useCallback, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMe } from '../../lib/api/hooks';
import { Icon } from '../ui/Icon';
import { Skeleton } from '../ui/Skeleton';
import { ShellPopover } from './ShellPopover';

/** "Priya Raman" -> "PR"; falls back to the email's first letter. */
export function initials(displayName: string | null | undefined, email: string): string {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return email.charAt(0).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return `${first}${last}`.toUpperCase();
}

export function UserMenu() {
  const { data: me, isPending } = useMe();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);

  if (isPending) return <Skeleton data-testid="shell-user-menu-skeleton" className="h-9 w-9 rounded-full" />;
  if (!me) return null;

  const name = me.displayName || me.email;
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid="shell-user-menu-button"
        aria-label="Account menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
          {initials(me.displayName, me.email)}
        </span>
      </button>
      <ShellPopover id={id} open={open} onClose={close} triggerRef={triggerRef} label="Account menu" className="w-76">
        <div className="flex flex-col gap-0.5 px-5 pt-5">
          <p className="font-bold">{name}</p>
          <p className="text-xs text-muted-foreground">{me.email}</p>
        </div>
        <ul aria-label="Your roles" className="flex flex-wrap gap-1.5 border-b border-border px-5 pb-4 pt-3">
          {me.roles.map((r) => (
            <li key={r} className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
              {r}
            </li>
          ))}
        </ul>
        <div className="p-2">
          <Link
            to="/settings"
            onClick={close}
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Icon name="sliders" size={16} />
            Settings
          </Link>
        </div>
      </ShellPopover>
    </div>
  );
}
