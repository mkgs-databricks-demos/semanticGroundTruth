// client/src/components/layout/AppLayout.tsx — app shell with header, nav, notifications
// Session 12 · Wave 4 · No enum, no namespace, no default export

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
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { NavLinks } from './NavLinks';
import { NotificationBell } from './NotificationBell';

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

export function AppLayout() {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-4 md:px-6 py-3 flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground whitespace-nowrap">
          Semantic Ground Truth
        </h1>

        {/* Desktop nav */}
        <NavLinks className="hidden md:flex gap-1" />

        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
        <nav className="fixed bottom-0 inset-x-0 z-50 border-t bg-background px-2 py-1 flex justify-around md:hidden">
          <NavLinks variant="bottom" />
        </nav>
      )}

      <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
        <Outlet />
      </main>
    </div>
  );
}
