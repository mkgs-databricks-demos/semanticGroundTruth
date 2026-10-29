// @a11y-strict
// client/src/components/layout/ShellIcons.tsx — shell glyphs with no brand-catalog icon
// Session 49 · Build 5 · wave 5-1
//
// The Databricks functional set (components/ui/Icon, session 42) has no sun,
// moon, monitor or menu icon. The Figma export draws these four inline
// (FallbackPages.tsx / ShellPage.tsx fallbacks); they are ported here as
// stroke-only SVGs in currentColor, so they follow the text token in both
// modes and in forced-colors mode. Decorative: the button carries the name.

import type { ReactNode } from 'react';

export type ShellGlyphName = 'sun' | 'moon' | 'monitor' | 'menu';

const PATHS: Record<ShellGlyphName, ReactNode> = {
  sun: (
    <>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M13 3l-1.5 1.5M4.5 11.5 3 13" />
    </>
  ),
  moon: <path d="M12.5 10.5A5.5 5.5 0 0 1 5.5 3.5a5 5 0 1 0 7 7Z" />,
  monitor: (
    <>
      <rect x="1.5" y="2.5" width="13" height="9" rx="1" />
      <path d="M5.5 14h5M8 11.5V14" />
    </>
  ),
  menu: <path d="M2 4h12M2 8h12M2 12h12" />,
};

export function ShellGlyph({ name, size = 20 }: { name: ShellGlyphName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-glyph={name}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
