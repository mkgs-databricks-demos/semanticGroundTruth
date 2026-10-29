// @a11y-strict
// client/src/components/settings/SettingsSection.tsx — one titled section of the Settings form
// Session 52 · Build 5 · wave 5-2 (S7 sections: Appearance, Motion, Review, Notifications, About)
//
// A <section> labelled by its <h2>, with the id the section index links to.

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export const SETTINGS_SECTIONS = [
  { id: 'settings-appearance', title: 'Appearance' },
  { id: 'settings-motion', title: 'Motion' },
  { id: 'settings-review', title: 'Review' },
  { id: 'settings-notifications', title: 'Notifications' },
  { id: 'settings-about', title: 'About' },
] as const;

export interface SettingsSectionProps {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({ id, title, description, children, className }: SettingsSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('flex scroll-mt-24 flex-col gap-4 rounded-lg border border-border bg-card p-5 text-card-foreground', className)}
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

/** In-page links to the sections (desktop side index). */
export function SettingsIndex() {
  return (
    <nav aria-label="Settings sections" className="hidden md:block">
      <ul className="sticky top-24 flex flex-col gap-1">
        {SETTINGS_SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="flex min-h-[44px] items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {s.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
