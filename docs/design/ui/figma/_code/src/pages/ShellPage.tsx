import { useEffect, useRef, useState } from 'react'
import { BrandIcon, BrandLogo } from '../components/BrandAssets'

type ShellState = 'populated' | 'loading' | 'notifications-empty' | 'notifications-error' | 'offline'

const nav = [
  ['Review', 'review', '/review', 'shell-nav-link-review'],
  ['Leaderboard', 'ranking', '/leaderboard', 'shell-nav-link-leaderboard'],
  ['Assistant', 'sparkle', '/assistant', 'shell-nav-link-assistant'],
  ['Steward', 'shield', '/steward', 'shell-nav-link-steward'],
  ['Executive', 'chart', '/executive', 'shell-nav-link-executive'],
  ['Admin', 'gear', '/admin', 'shell-nav-link-admin'],
]

export default function ShellPage() {
  const [dark, setDark] = useState(false)
  const [state, setState] = useState<ShellState>('populated')
  const [drawer, setDrawer] = useState(false)
  const [account, setAccount] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (drawer) {
        setDrawer(false)
        menuRef.current?.focus()
      }
      if (state === 'notifications-empty') {
        setState('populated')
        bellRef.current?.focus()
      }
      setAccount(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [drawer, state])

  const notificationsOpen = state === 'notifications-empty'
  return (
    <div className={`app shell-preview-page ${dark ? 'dark' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="shell-header" data-testid="shell-header-root">
        <div className="brand-bar" />
        <div className="header-inner">
          <button ref={menuRef} className="icon-button menu-button" aria-label="Open navigation menu" onClick={() => setDrawer(true)}>
            <BrandIcon name="menu" />
          </button>
          <a className="product-link" href="/review"><BrandLogo /><span>Semantic Ground Truth</span></a>
          <nav className="desktop-nav" aria-label="Main navigation">
            {nav.map(([label, icon, href, testId], index) =>
              state === 'loading' && index > 2
                ? <span className="nav-skeleton" key={label} />
                : <a key={label} href={href} className={label === 'Review' ? 'active' : ''} data-testid={testId}><BrandIcon name={icon} /><span>{label}</span></a>,
            )}
          </nav>
          <div className="header-actions">
            <div className="popover-anchor">
              <button
                ref={bellRef}
                className="icon-button"
                data-testid="shell-bell-button"
                aria-label={state === 'notifications-error' ? 'Notifications unavailable' : 'Notifications (2 unread)'}
                onClick={() => state !== 'notifications-error' && setState(notificationsOpen ? 'populated' : 'notifications-empty')}
              >
                <BrandIcon name="bell" size={20} />
                {state === 'notifications-error' ? <span className="muted-dot" /> : <span className="bell-count" data-testid="shell-bell-count">2</span>}
              </button>
              {state === 'notifications-error' && <span className="error-tooltip">Notifications unavailable</span>}
              {notificationsOpen && <section className="popover notifications" role="dialog" aria-label="Notifications">
                <div className="notification-empty"><span className="empty-check"><BrandIcon name="check" /></span><h3>You're all caught up</h3><p>New activity will appear here.</p></div>
              </section>}
            </div>
            <button className="icon-button" data-testid="shell-theme-toggle" aria-label={dark ? 'Switch to system theme' : 'Switch to dark theme'} onClick={() => setDark(!dark)}><BrandIcon name={dark ? 'moon' : 'sun'} size={20} /></button>
            <div className="popover-anchor">
              <button className="account-trigger" data-testid="shell-user-menu-button" aria-label="Account menu" onClick={() => setAccount(!account)}><span className="avatar">PR</span></button>
              {account && <section className="popover account-menu" role="dialog" aria-label="Account menu"><div className="account-summary"><span className="avatar large">PR</span><div><strong>Priya Raman</strong><span>priya.raman@example.com</span></div></div><div className="role-row"><span>reviewer</span><span>steward</span></div><div className="menu-list"><a href="/settings"><BrandIcon name="sliders" />Settings</a><a href="#shortcuts"><BrandIcon name="keyboard" />Keyboard shortcuts</a></div></section>}
            </div>
          </div>
        </div>
      </header>
      {state === 'offline' && <div className="offline-banner" data-testid="shell-offline-banner"><BrandIcon name="cloudOff" /><span><strong>You're offline.</strong> Votes and edits are paused until the connection is back.</span></div>}
      {drawer && <><button className="drawer-scrim" aria-label="Close navigation menu" onClick={() => setDrawer(false)} /><aside className="drawer" role="dialog" aria-modal="true" aria-label="Navigation menu"><div className="drawer-heading"><BrandLogo /><strong>Menu</strong><button className="icon-button" aria-label="Close navigation menu" onClick={() => setDrawer(false)}><BrandIcon name="close" /></button></div><nav aria-label="Main navigation">{nav.map(([label, icon, href]) => <a href={href} key={label}><BrandIcon name={icon} />{label}</a>)}</nav></aside></>}
      <main id="main-content" className="shell-preview-main">
        <section><p className="eyebrow">APP SHELL</p><h1>Review semantic assets</h1><p>The shared navigation stays clear and predictable across every workflow.</p></section>
        <div className="shell-preview-card"><span>MEASURE</span><h2>Readmission Rate (30-day)</h2><p>Review definitions with the context needed to make a confident decision.</p></div>
        <aside className="state-switcher"><strong>Preview state</strong><div>{(['populated', 'loading', 'notifications-empty', 'notifications-error', 'offline'] as ShellState[]).map(value => <button key={value} className={state === value ? 'active' : ''} onClick={() => setState(value)}>{value}</button>)}</div></aside>
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">{nav.slice(0, 4).map(([label, icon, href]) => <a key={label} href={href} className={label === 'Review' ? 'active' : ''}><BrandIcon name={icon} size={20} /><span>{label}</span></a>)}</nav>
    </div>
  )
}
