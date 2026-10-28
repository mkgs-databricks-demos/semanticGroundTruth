// client/src/components/ui/EmptyPanel.tsx — empty state with a brand illustration
// Session 42 · Build 5 · wave 5-0. Ported from BrandIllustration in the Figma
// export: primary icons use the navy file on light and the white file on dark
// (no recoloring, figma_make_brief §4). The illustration is decorative.

import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type Illustration =
  | 'unity-catalog'
  | 'data-quality-3'
  | 'users'
  | 'dashboards'
  | 'chat'
  | 'governance';

export function illustrationUrls(name: Illustration) {
  return {
    light: `/brand/icons/primary-icon-navy-${name}.svg`,
    dark: `/brand/icons/primary-icon-white-${name}.svg`,
  };
}

export interface EmptyPanelProps {
  title: string;
  description?: ReactNode;
  illustration?: Illustration;
  /** Optional call to action, e.g. a Button. */
  action?: ReactNode;
  /** Heading level of the title (default 2). */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

export function EmptyPanel({
  title,
  description,
  illustration = 'unity-catalog',
  action,
  headingLevel = 2,
  className,
}: EmptyPanelProps) {
  const urls = illustrationUrls(illustration);
  const Heading = `h${headingLevel}` as const;
  return (
    <section
      data-slot="empty-panel"
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center text-card-foreground',
        className,
      )}
    >
      <span className="relative block h-11 w-11" aria-hidden="true">
        <img src={urls.light} alt="" className="absolute inset-0 h-full w-full object-contain dark:hidden" />
        <img src={urls.dark} alt="" className="absolute inset-0 hidden h-full w-full object-contain dark:block" />
      </span>
      <Heading className="text-lg font-bold">{title}</Heading>
      {description ? <div className="max-w-md text-sm text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </section>
  );
}
