// @a11y-strict
// client/src/components/layout/AppLayout.tsx — app shell with header, nav, notifications
// Session 16 · Wave 0 · Databricks symbol + DM Sans Bold name, 3-state theme toggle
// Session 49 · Build 5 · wave 5-1: header variant A (Oat Light / Gray
// Navigation, 4 px brand bar), product name is a link, not the page heading
// (F2; every page renders its own level-1 heading); skip link to #main; Databricks icons
// and one NavItem for desktop, drawer and bottom nav (F6, F7); steward
// sub-nav on /steward*; offline banner; account menu.
//
// Tab order (S0): Skip to content -> product link -> nav -> bell -> theme ->
// account menu (-> mobile menu button, which only shows below md).

import { useState } from 'react';
import type { MouseEvent } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useMe } from '../../lib/api/hooks';
import { hasRole } from '../../lib/api/roles';
import { usePersistedTheme } from '../../lib/settings/ThemeSync';
import { Sheet } from '../ui/Sheet';
import { NavLinks } from './NavLinks';
import { NotificationBell } from './NotificationBell';
import type { NotificationBellProps } from './NotificationBell';
import { OfflineBanner } from './OfflineBanner';
import { ShellGlyph } from './ShellIcons';
import { StewardSubNav } from './StewardSubNav';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

// public/ directory assets — referenced as URL strings, not ES imports
export const SYMBOL_COLOR = '/brand/databricks-symbol-color.svg';
export const SYMBOL_LIGHT = '/brand/databricks-symbol-light.svg';

export const MAIN_ID = 'main';
export const PRODUCT_NAME = 'Semantic Ground Truth';

export interface AppLayoutProps {
  /** Forwarded to the bell popover (session 56 mounts Share to Slack here). */
  notificationActions?: NotificationBellProps['notificationActions'];
}

/** Moves focus to <main> (hash links do not move focus in every browser). */
function skipToMain(event: MouseEvent<HTMLAnchorElement>) {
  const main = document.getElementById(MAIN_ID);
  if (!main) return;
  event.preventDefault();
  main.focus();
  main.scrollIntoView?.({ block: 'start' });
}

export function AppLayout({ notificationActions }: AppLayoutProps = {}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { resolvedTheme } = usePersistedTheme();
  const { data: me } = useMe();
  const { pathname } = useLocation();

  const symbol = resolvedTheme === 'dark' ? SYMBOL_LIGHT : SYMBOL_COLOR;
  const showStewardNav = hasRole(me, 'steward') && (pathname === '/steward' || pathname.startsWith('/steward/'));

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href={`#${MAIN_ID}`}
        onClick={skipToMain}
        className="fixed left-4 top-2 z-[100] -translate-y-[150%] rounded-lg border border-input bg-card px-3 py-2 font-bold text-foreground focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-ring"
      >
        Skip to content
      </a>

      <header data-testid="shell-header-root" className="sticky top-0 z-40 h-16 border-b border-border bg-background">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-accent" />
        <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-8 px-4 pt-1 md:px-6">
          <Link
            to="/"
            data-testid="shell-product-link"
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-lg font-bold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <img src={symbol} alt="" data-testid="shell-product-symbol" className="h-6 w-6" />
            <span>{PRODUCT_NAME}</span>
          </Link>

          <NavLinks label="Main navigation" className="hidden h-full md:flex" />

          <div className="ml-auto flex items-center gap-1">
            <NotificationBell notificationActions={notificationActions} />
            <ThemeToggle />
            <UserMenu />
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring md:hidden"
            >
              <ShellGlyph name="menu" />
            </button>
          </div>
        </div>
      </header>

      <OfflineBanner />
      {showStewardNav ? <StewardSubNav /> : null}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} title="Navigation menu" side="left">
        <NavLinks label="Drawer navigation" variant="drawer" onNavigate={() => setDrawerOpen(false)} />
      </Sheet>

      <main id={MAIN_ID} tabIndex={-1} className="mx-auto w-full max-w-screen-2xl flex-1 p-4 pb-24 focus-visible:outline-2 focus-visible:outline-ring md:p-6 md:pb-6">
        <Outlet />
      </main>

      <NavLinks
        label="Mobile navigation"
        variant="bottom"
        limit={4}
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background md:hidden"
      />
    </div>
  );
}
