import type { CSSProperties, ReactNode } from 'react'

const assetModules = import.meta.glob<string>('../assets/brand/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

function brandUrl(file: string) {
  const entry = Object.entries(assetModules).find(([path]) => path.endsWith(`/${file}`))
  return entry?.[1] ?? `/brand/${file}`
}

const iconFiles: Record<string, string> = {
  review: 'checklistIcon.svg',
  checklist: 'checklistIcon.svg',
  ranking: 'BarsDescendingVerticalIcon.svg',
  sparkle: 'SparkleIcon.svg',
  shield: 'ShieldCheckIcon.svg',
  chart: 'dashboardIcon.svg',
  dashboard: 'dashboardIcon.svg',
  gear: 'gearOutlinedIcon.svg',
  sliders: 'SlidersIcon.svg',
  check: 'checkIcon.svg',
  close: 'closeIcon.svg',
  pencil: 'pencilIcon.svg',
  skip: 'chevronDoubleRightIcon.svg',
  query: 'queryListViewIcon.svg',
  branch: 'BranchIcon.svg',
  bell: 'notificationIcon.svg',
  search: 'searchIcon.svg',
  filter: 'filterIcon.svg',
  keyboard: 'keyboardIcon.svg',
  refresh: 'refreshIcon.svg',
  cloud: 'cloudOffIcon.svg',
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
}

export function BrandIcon({
  name,
  size = 16,
  fallback,
}: {
  name: string
  size?: number
  fallback?: ReactNode
}) {
  const file = iconFiles[name]
  if (!file) {
    return (
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {fallback}
      </svg>
    )
  }

  const url = `url("${brandUrl(file)}")`
  return (
    <span
      aria-hidden="true"
      className="brand-functional-icon"
      style={
        {
          width: size,
          height: size,
          WebkitMaskImage: url,
          maskImage: url,
        } as CSSProperties
      }
    />
  )
}

export function BrandLogo() {
  return (
    <span className="brand-logo" aria-hidden="true">
      <img className="brand-logo-light" src={brandUrl('databricks-symbol-color.svg')} alt="" />
      <img className="brand-logo-dark" src={brandUrl('databricks-symbol-light.svg')} alt="" />
    </span>
  )
}

export function BrandProductIcon({
  file,
  label,
  className = '',
}: {
  file: string
  label: string
  className?: string
}) {
  return <img className={`brand-product-icon ${className}`} src={brandUrl(file)} alt={label} />
}

export function BrandIllustration({ name }: { name: string }) {
  return (
    <span className="brand-illustration" aria-hidden="true">
      <img
        className="brand-illustration-light"
        src={brandUrl(`primary-icon-navy-${name}.svg`)}
        alt=""
      />
      <img
        className="brand-illustration-dark"
        src={brandUrl(`primary-icon-white-${name}.svg`)}
        alt=""
      />
    </span>
  )
}
