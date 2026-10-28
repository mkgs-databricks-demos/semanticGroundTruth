// @a11y-strict
// client/src/components/ui/Icon.tsx — Databricks functional brand icons
// Session 42 · Build 5 · wave 5-0. Ported from the Figma export
// (docs/design/ui/figma/_code/src/components/BrandAssets.tsx, BrandIcon).
//
// The SVG is a CSS mask filled with currentColor (class .brand-icon in
// index.css), so icons inherit the text color in both modes and in forced-colors
// mode (CanvasText). No svgr or other dependency, and no runtime CDN request:
// files are served from /brand/icons/ (client/public/brand/icons/).
//
// ICON_FILES mirrors the `functional` + `downloaded` entries of
// client/public/brand/icons/icons.manifest.json; Icon.test.tsx keeps them equal.

import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';

export const ICON_FILES = {
  checklist: 'checklistIcon.svg',
  ranking: 'BarsDescendingVerticalIcon.svg',
  sparkle: 'SparkleIcon.svg',
  shield: 'ShieldCheckIcon.svg',
  dashboard: 'dashboardIcon.svg',
  gear: 'gearOutlinedIcon.svg',
  sliders: 'SlidersIcon.svg',
  check: 'checkIcon.svg',
  close: 'closeIcon.svg',
  pencil: 'pencilIcon.svg',
  skip: 'chevronDoubleRightIcon.svg',
  query: 'queryListViewIcon.svg',
  fork: 'forkIcon.svg',
  branch: 'BranchIcon.svg',
  commit: 'GitCommitIcon.svg',
  bell: 'notificationIcon.svg',
  search: 'searchIcon.svg',
  filter: 'filterIcon.svg',
  keyboard: 'keyboardIcon.svg',
  refresh: 'refreshIcon.svg',
  cloudOff: 'cloudOffIcon.svg',
  lock: 'lockOutlinedIcon.svg',
  warning: 'warningOutlinedIcon.svg',
  danger: 'DangerIcon.svg',
  measure: 'MeasureIcon.svg',
  info: 'InfoBookIcon.svg',
  tag: 'TagIcon.svg',
  users: 'userGroupIcon.svg',
  history: 'historyIcon.svg',
  external: 'newWindowIcon.svg',
  trash: 'trashIcon.svg',
  plus: 'plusIcon.svg',
  copy: 'copyIcon.svg',
  fileCode: 'fileCodeIcon.svg',
  arrowUp: 'arrowUpIcon.svg',
  arrowDown: 'arrowDownIcon.svg',
  send: 'SendIcon.svg',
  folderBranch: 'FolderBranchIcon.svg',
} as const;

/** Every functional icon committed under /brand/icons/. */
export type IconName = keyof typeof ICON_FILES;

export const ICON_BASE_URL = '/brand/icons/';

export function iconUrl(name: IconName): string {
  return `${ICON_BASE_URL}${ICON_FILES[name]}`;
}

export interface IconProps {
  name: IconName;
  /** Square size in px (default 16). */
  size?: number;
  /** Accessible name. Without it the icon is decorative (aria-hidden). */
  label?: string;
  className?: string;
}

export function Icon({ name, size = 16, label, className }: IconProps) {
  const url = `url("${iconUrl(name)}")`;
  const style: CSSProperties = {
    width: size,
    height: size,
    WebkitMaskImage: url,
    maskImage: url,
  };
  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const };
  return (
    <span
      {...a11y}
      data-icon={name}
      className={cn('brand-icon', className)}
      style={style}
    />
  );
}
