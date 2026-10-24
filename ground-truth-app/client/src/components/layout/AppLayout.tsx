// client/src/components/layout/AppLayout.tsx — app shell with header, nav, notifications
// Session 16 · Wave 0 · Databricks symbol + DM Sans Bold name, 3-state theme toggle

import { useState } from 'react';
import { Outlet } from 'react-router';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  useIsMobile,
} from '@databricks/appkit-ui/react';
import { Menu, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NavLinks } from './NavLinks';
import { NotificationBell } from './NotificationBell';

// public/ directory assets — referenced as URL strings, not ES imports
const SYMBOL_COLOR = '/brand/databricks-symbol-color.svg';
const SYMBOL_LIGHT = '/brand/databricks-symbol-light.svg';

/** Theme cycle: light → dark → system → light */
const THEME_CYCLE = ['light', 'dark', 'system'] as const;

function nextTheme(current: string | undefined): string {
  const idx = THEME_CYCLE.indexOf(current as typeof THEME_CYCLE[number]);
  return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
}

function themeAriaLabel(current: string | undefined): string {
  const next = nextTheme(current);
  return `Switch to ${next} theme`;
}

function ThemeIcon({ theme }: { theme: string | undefined }) {
  if (theme === 'dark') return <Moon className="h-4 w-4" />;
  if (theme === 'system') return <Monitor className="h-4 w-4" />;
  return <Sun className="h-4 w-4" />;
}

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

export function AppLayout() {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  const toggleTheme = () => setTheme(nextTheme(theme));
  const symbol = resolvedTheme === 'dark' ? SYMBOL_LIGHT : SYMBOL_COLOR;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 md:px-6 py-3 flex items-center gap-4">
        {/* Databricks symbol + product name */}
        <div className="flex items-center gap-2 shrink-0">
          <img src={symbol} alt="" aria-hidden="true" className="h-6 w-6" />
          <h1 className="text-lg font-bold text-foreground whitespace-nowrap">
            Semantic Ground Truth
          </h1>
        </div>

        {/* Desktop nav */}
        <NavLinks className="hidden md:flex gap-1" />

        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={themeAriaLabel(theme)}
          >
            <ThemeIcon theme={theme} />
          </Button>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <Sheet open={mobileNavOpen && isMobile} onOpenChange={setMobileNavOpen}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <NavLinks
                  className="flex flex-col gap-1 mt-4"
                  linkClass={mobileNavLinkClass}
                  onClick={() => setMobileNavOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav
          className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background px-2 py-1 flex justify-around md:hidden"
          aria-label="Mobile navigation"
        >
          <NavLinks variant="bottom" />
        </nav>
      )}

      <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
        <Outlet />
      </main>
    </div>
  );
}
