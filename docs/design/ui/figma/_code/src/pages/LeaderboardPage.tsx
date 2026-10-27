import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { BrandIcon, BrandIllustration, BrandLogo } from '../components/BrandAssets'

type PageState = 'populated' | 'loading' | 'empty' | 'error' | 'offline'
const icons: Record<string, ReactNode> = {
  review: <><path d="M3 4h1M3 8h1M3 12h1M7 4h6M7 8h6M7 12h6" /></>,
  ranking: <path d="M3 4h7M3 8h10M3 12h5" />,
  sparkle: <path d="m8 2 .8 3.2L12 6l-3.2.8L8 10l-.8-3.2L4 6l3.2-.8L8 2Z" />,
  shield: <path d="M8 2.5 13 4v3.5c0 3-2 5-5 6-3-1-5-3-5-6V4l5-1.5Z" />,
  chart: <path d="M3 12V8M8 12V3M13 12V6" />,
  gear: <><circle cx="8" cy="8" r="2.5" /><path d="M8 2v2M8 12v2M2 8h2M12 8h2" /></>,
  bell: <path d="M4 11h8l-1-2V6a3 3 0 0 0-6 0v3l-1 2Zm3 2h2" />,
  moon: <path d="M12.5 10.5A5.5 5.5 0 0 1 5.5 3.5a5 5 0 1 0 7 7Z" />,
  menu: <path d="M2 4h12M2 8h12M2 12h12" />,
  skip: <path d="m3 4 4 4-4 4M8 4l4 4-4 4" />,
  users: <><circle cx="6" cy="5" r="2.5" /><path d="M2 13c.4-2.4 1.7-3.5 4-3.5s3.6 1.1 4 3.5M10 4.2c2.1-.2 3.2.8 3.2 2.3S12.3 9 10.8 9" /></>,
  danger: <><path d="M8 2 14 13H2L8 2Z" /><path d="M8 6v3M8 11h.01" /></>,
  trophy: <path d="M5 3h6v3a3 3 0 0 1-6 0V3Zm3 6v3M5 14h6M5 4H2v1a3 3 0 0 0 3 3M11 4h3v1a3 3 0 0 1-3 3" />,
  check: <path d="m3 8 3 3 7-7" />,
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  pencil: <path d="m3 13 1-3 7-7 2 2-7 7-3 1Z" />,
  fire: <path d="M8 14c-2.7 0-4.5-1.7-4.5-4.2 0-2 1.4-3.4 2.5-4.6.2 1.5.9 2.2 1.4 2.4C7.2 5 8.5 3 10 2c0 2.7 2.5 4 2.5 7.7C12.5 12.3 10.6 14 8 14Z" />,
}
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return <BrandIcon name={name} size={size} fallback={icons[name]} />
}
function Logo() { return <BrandLogo /> }
const nav = [['Review', 'review'], ['Leaderboard', 'ranking'], ['Assistant', 'sparkle'], ['Steward', 'shield'], ['Executive', 'chart'], ['Admin', 'gear']]
const stats = [
  ['Rank', '#3', 'trophy'], ['Total votes', '186', 'ranking'], ['Approvals', '131', 'check'], ['Rejections', '29', 'close'],
  ['Edits', '26', 'pencil'], ['Streak', '6d', 'fire'], ['Coverage', '35%', 'chart'], ['Skipped', '14', 'skip'],
]
const people = [
  { id: 'user-ada', rank: 1, name: 'Ada Okafor', votes: 242, approvals: 181, edits: 38, streak: '12d' },
  { id: 'user-mateo', rank: 2, name: 'Mateo Silva', votes: 211, approvals: 156, edits: 31, streak: '8d' },
  { id: 'user-priya', rank: 3, name: 'Priya Raman', votes: 186, approvals: 131, edits: 26, streak: '6d', current: true },
  { id: 'user-jules', rank: 4, name: 'Jules Martin', votes: 164, approvals: 119, edits: 24, streak: '4d' },
  { id: 'user-emiko', rank: 5, name: 'Emiko Sato', votes: 147, approvals: 104, edits: 22, streak: '9d' },
  { id: 'user-sam', rank: 6, name: 'Sam Rivera', votes: 132, approvals: 96, edits: 18, streak: '3d' },
]

export default function App() {
  const [dark, setDark] = useState(false)
  const [state, setState] = useState<PageState>('populated')
  const [period, setPeriod] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const periods = ['7 days', '30 days', 'All time']
  const moveTab = (event: KeyboardEvent, index: number) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'ArrowRight' ? (index + 1) % periods.length : (index + periods.length - 1) % periods.length
    setPeriod(next)
    tabRefs.current[next]?.focus()
  }
  return <div className={`app leaderboard-app ${dark ? 'dark' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="shell-header" data-testid="shell-header-root"><div className="brand-bar" /><div className="header-inner">
      <button className="icon-button menu-button" aria-label="Open navigation"><Icon name="menu" size={20} /></button>
      <a className="product-link" href="/review"><Logo /><span>Semantic Ground Truth</span></a>
      <nav className="desktop-nav" aria-label="Main navigation">{nav.map(([name, icon]) => <a key={name} className={name === 'Leaderboard' ? 'active' : ''} href={name === 'Steward' ? '/steward' : `/${name.toLowerCase()}`}><Icon name={icon} /><span>{name}</span></a>)}</nav>
      <div className="header-actions"><button className="icon-button" aria-label="Notifications (2 unread)"><Icon name="bell" size={20} /><span className="bell-count">2</span></button><button className="icon-button" aria-label="Switch theme" onClick={() => setDark(!dark)}><Icon name="moon" size={20} /></button><button className="account-trigger" aria-label="Account menu"><span className="avatar">PR</span></button></div>
    </div></header>
    <main id="main-content" className="leaderboard-main">
      <div className="leaderboard-heading"><div><p className="eyebrow">COMMUNITY</p><h1>Leaderboard</h1><p>See who's helping make semantic definitions more trustworthy.</p></div>{state === 'offline' && <span className="updated"><span />Last updated 5 min ago</span>}</div>
      {state === 'loading' ? <Loading /> : state === 'empty' ? <Empty /> : state === 'error' ? <ErrorState retry={() => setState('populated')} /> : <>
        <section className="my-stats" data-testid="leaderboard-stats-root">
          <div className="stats-heading"><div><span className="avatar large">PR</span><div><h2>My stats</h2><p>Priya Raman · This period</p></div></div><span className="rank-change"><span>↑ 2</span> since last week</span></div>
          <div className="leaderboard-stats">{stats.map(([label, value, icon]) => <div className="stat" key={label} data-testid={label === 'Rank' ? 'leaderboard-stats-rank' : label === 'Skipped' ? 'leaderboard-stats-skipped' : undefined}><span className={`stat-icon ${label.toLowerCase()}`}><Icon name={icon} /></span><div><span>{label}</span><strong>{value}</strong></div></div>)}</div>
          <p className="stats-footnote"><Icon name="skip" />Skips don't count toward rank</p>
        </section>
        <section className="rankings">
          <div className="rankings-top"><div><h2>Top reviewers</h2><p>Ranked by votes and consistency</p></div><div className="period-tabs" role="tablist" aria-label="Leaderboard period" data-testid="leaderboard-period-tabs">{periods.map((label, i) => <button key={label} ref={el => { tabRefs.current[i] = el }} role="tab" aria-selected={period === i} tabIndex={period === i ? 0 : -1} onClick={() => setPeriod(i)} onKeyDown={event => moveTab(event, i)}>{label}</button>)}</div></div>
          <div className="leaderboard-table-wrap" data-testid="leaderboard-table-root"><table>
            <caption className="sr-only">Top reviewers, last 7 days</caption>
            <thead><tr><th scope="col">Rank</th><th scope="col">Name</th><th scope="col">Votes</th><th scope="col">Approvals</th><th scope="col">Edits</th><th scope="col">Streak</th></tr></thead>
            <tbody>{people.map(person => <tr key={person.id} data-testid="leaderboard-table-row" data-user-id={person.id} className={person.current ? 'current-user' : ''}>
              <td>{person.rank <= 3 ? <span className={`medal medal-${person.rank}`} aria-label={`${person.rank === 1 ? '1st' : person.rank === 2 ? '2nd' : '3rd'} place`}><Icon name="trophy" size={20} /><b>{person.rank}</b></span> : <span className="plain-rank">{person.rank}</span>}</td>
              <td><div className="person" data-testid={person.current ? 'leaderboard-table-current-user' : undefined}><span className="person-avatar">{person.name.split(' ').map(n => n[0]).join('')}</span><strong>{person.name}</strong>{person.current && <span className="you-badge">You</span>}</div></td>
              <td><strong>{person.votes}</strong></td><td>{person.approvals}</td><td>{person.edits}</td><td><span className="streak-cell"><Icon name="fire" />{person.streak}</span></td>
            </tr>)}</tbody>
          </table></div>
        </section>
      </>}
      <aside className="state-switcher"><strong>Preview state</strong><div>{(['populated', 'loading', 'empty', 'error', 'offline'] as PageState[]).map(value => <button key={value} className={state === value ? 'active' : ''} onClick={() => setState(value)}>{value}</button>)}</div></aside>
    </main>
    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.slice(0, 4).map(([name, icon]) => <a key={name} className={name === 'Leaderboard' ? 'active' : ''} href={name === 'Steward' ? '/steward' : `/${name.toLowerCase()}`}><Icon name={icon} size={20} /><span>{name}</span></a>)}</nav>
  </div>
}

function Loading() {
  return <><section className="my-stats stats-loading"><div className="skeleton title-skeleton" /><div className="leaderboard-stats">{Array.from({ length: 8 }).map((_, i) => <div className="stat" key={i}><span className="skeleton circle-skeleton" /><div><span className="skeleton small-skeleton" /><strong className="skeleton value-skeleton" /></div></div>)}</div></section><section className="rankings table-loading"><div className="skeleton title-skeleton" />{Array.from({ length: 5 }).map((_, i) => <div className="row-skeleton" key={i}><i /><i /><i /><i /></div>)}</section></>
}
function Empty() {
  return <section className="leaderboard-empty" data-testid="leaderboard-empty-root"><span className="empty-users"><BrandIllustration name="users" /></span><h2>No reviews in this period yet</h2><p>Be the first to help your team certify a semantic asset.</p><button>Start reviewing</button></section>
}
function ErrorState({ retry }: { retry: () => void }) {
  return <section className="leaderboard-error"><Icon name="danger" size={24} /><div><strong>We couldn't load the leaderboard</strong><p>Your stats are safe. Try loading this page again.</p></div><button data-testid="leaderboard-error-retry" onClick={retry}>Retry</button></section>
}
