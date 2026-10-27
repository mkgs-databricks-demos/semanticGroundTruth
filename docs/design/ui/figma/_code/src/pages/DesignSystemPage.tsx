import { useState, type ReactNode } from 'react'
import { BrandIcon, BrandLogo } from '../components/BrandAssets'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  loading?: boolean
}

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    check: <path d="m4 8 2.5 2.5L12 5" />,
    close: <path d="m5 5 6 6M11 5l-6 6" />,
    pencil: <path d="m4 12 1-3 5.5-5.5 2 2L7 11l-3 1Z" />,
    search: <><circle cx="7" cy="7" r="4" /><path d="m10 10 3 3" /></>,
    filter: <path d="M3 4h10L9 8v4l-2 1V8L3 4Z" />,
    gear: <><circle cx="8" cy="8" r="2.5" /><path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.8 3.8l1.4 1.4M10.8 10.8l1.4 1.4M12.2 3.8l-1.4 1.4M5.2 10.8l-1.4 1.4" /></>,
    branch: <><circle cx="5" cy="4" r="1.5" /><circle cx="11" cy="11.5" r="1.5" /><path d="M5 5.5v2A4 4 0 0 0 9 11.5h.5M11 3v3L8.5 8.5" /></>,
    shield: <path d="M8 2.5 13 4v3.5c0 3-2 5-5 6-3-1-5-3-5-6V4l5-1.5Zm-2 5 1.3 1.3L10.5 6" />,
    dashboard: <path d="M3 3h4v4H3V3Zm6 0h4v7H9V3ZM3 9h4v4H3V9Zm6 3h4v1H9v-1Z" />,
    bell: <path d="M4 11h8l-1-2V6a3 3 0 0 0-6 0v3l-1 2Zm3 2h2" />,
    menu: <path d="M3 4h10M3 8h10M3 12h10" />,
    moon: <path d="M12.5 10.5A5.5 5.5 0 0 1 5.5 3.5a5 5 0 1 0 7 7Z" />,
    info: <><circle cx="8" cy="8" r="6" /><path d="M8 7v4M8 5h.01" /></>,
    plus: <path d="M8 3v10M3 8h10" />,
  }
  return <BrandIcon name={name} size={size} fallback={paths[name]} />
}

function Button({ variant = 'default', size = 'default', loading, children, className = '', ...props }: ButtonProps) {
  return <button className={`button button-${variant} button-${size} ${className}`} {...props}>
    {loading && <span className="spinner" aria-hidden="true" />}
    {children}
  </button>
}

function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

const iconNames = ['check', 'close', 'pencil', 'search', 'filter', 'gear', 'branch', 'shield', 'dashboard', 'bell', 'menu', 'info']

function ModePanel({ dark = false }: { dark?: boolean }) {
  return <div className={`mode-panel ${dark ? 'dark' : ''}`}>
    <div className="mode-title">
      <div><Badge tone={dark ? 'dark' : 'default'}>{dark ? 'DARK' : 'LIGHT'}</Badge><h2>Semantic tokens</h2></div>
      <Icon name={dark ? 'moon' : 'dashboard'} size={20} />
    </div>
    <div className="swatches">
      {['background', 'foreground', 'card', 'muted', 'primary', 'brand-accent', 'success', 'warning', 'info', 'border'].map(token =>
        <div className="swatch-item" key={token}><span className={`swatch swatch-${token}`} /><span>{token}</span></div>
      )}
    </div>
    <div className="mode-sample">
      <div>
        <span className="eyebrow">CAMPAIGN 04</span>
        <h3>Customer value metrics</h3>
        <p>Review shared definitions before they become certified.</p>
      </div>
      <Badge tone="success"><Icon name="check" /> Certified</Badge>
    </div>
  </div>
}

function App() {
  const [dark, setDark] = useState(false)
  const [tab, setTab] = useState('Components')
  const [enabled, setEnabled] = useState(true)
  const [value, setValue] = useState('Medium')
  const [toast, setToast] = useState(false)

  return <div className={dark ? 'app dark' : 'app'}>
    <header className="topbar">
      <a className="brand" href="#" aria-label="Semantic Ground Truth review">
        <span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span>
        <span>Semantic Ground Truth</span>
      </a>
      <nav aria-label="Primary navigation">
        <a className="active" href="#"><Icon name="dashboard" />Design system</a>
        <a href="#"><Icon name="shield" />Review</a>
        <a href="#"><Icon name="branch" />Steward</a>
      </nav>
      <div className="header-actions">
        <Button variant="ghost" size="icon" aria-label="Notifications"><Icon name="bell" /></Button>
        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setDark(!dark)}><Icon name="moon" /></Button>
        <span className="avatar">AR</span>
      </div>
    </header>

    <main>
      <div className="page-heading">
        <div><p className="kicker">FOUNDATIONS · VERSION 1.0</p><h1>Design system</h1><p className="lede">The visual language for clear, confident semantic validation.</p></div>
        <Button size="lg" onClick={() => setToast(true)}><Icon name="plus" />Create campaign</Button>
      </div>

      <div className="tabs" role="tablist" aria-label="Design system sections">
        {['Foundations', 'Components', 'Patterns'].map(item => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}
      </div>

      <section className="section">
        <div className="section-heading"><div><h2>Color modes</h2><p>Every surface and state is mapped to a semantic token.</p></div><Badge><Icon name="check" />AA checked</Badge></div>
        <div className="mode-grid"><ModePanel /><ModePanel dark /></div>
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Type scale</h2><p>DM Sans for interface clarity. DM Mono for technical identifiers.</p></div></div>
        <Card className="type-card">
          <div className="type-row"><span>32 / 700</span><h1>One clear page title</h1></div>
          <div className="type-row"><span>24 / 700</span><h2>Section heading</h2></div>
          <div className="type-row"><span>20 / 700</span><h3>Review card title</h3></div>
          <div className="type-row"><span>16 / 400</span><p>Definitions should make sense to everyone who uses the data.</p></div>
          <div className="type-row"><span>14 / 500</span><strong>Dense table label</strong></div>
          <div className="type-row"><span>12 / 500</span><Badge>CAPTION</Badge></div>
          <div className="type-row"><span>14 / mono</span><code>analytics.customer_lifetime_value</code></div>
        </Card>
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Icon set</h2><p>Functional icons inherit the current text color.</p></div></div>
        <Card className="icon-grid">
          {iconNames.map(name => <div className="icon-cell" key={name}><Icon name={name} size={20} /><span>{name}</span></div>)}
        </Card>
      </section>

      <section className="section">
        <div className="section-heading"><div><h2>Components</h2><p>shadcn-compatible names and interaction states, re-skinned for AppKit.</p></div></div>
        <div className="component-grid">
          <Card>
            <div className="card-heading"><h3>Button</h3><Badge>INTERACTIVE</Badge></div>
            <div className="state-row"><span>Default</span><Button><Icon name="check" />Approve</Button><Button variant="secondary">Skip</Button><Button variant="outline">Edit</Button></div>
            <div className="state-row"><span>Destructive</span><Button variant="destructive"><Icon name="close" />Reject definition</Button></div>
            <div className="state-row"><span>Disabled · Loading</span><Button disabled>Approve</Button><Button loading>Saving</Button></div>
          </Card>
          <Card>
            <div className="card-heading"><h3>Inputs & controls</h3><Badge>44PX TARGETS</Badge></div>
            <label>Search assets<div className="input-wrap"><Icon name="search" /><input placeholder="Metric, domain or owner" /></div></label>
            <label>Confidence<select value={value} onChange={e => setValue(e.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label>Reviewer note<textarea placeholder="Explain what should change" /></label>
            <div className="control-line"><div><strong>Keyboard shortcuts</strong><p>Show hints while reviewing</p></div><button className={`switch ${enabled ? 'on' : ''}`} role="switch" aria-checked={enabled} onClick={() => setEnabled(!enabled)}><span /></button></div>
            <label>Approval threshold <input type="range" min="0" max="100" defaultValue="72" /></label>
          </Card>
          <Card className="wide-card">
            <div className="card-heading"><h3>Table & status</h3><div className="badge-row"><Badge tone="success"><Icon name="check" />Approved</Badge><Badge tone="warning"><Icon name="info" />Needs review</Badge><Badge tone="danger"><Icon name="close" />Rejected</Badge></div></div>
            <div className="table-wrap"><table><thead><tr><th scope="col">Semantic asset</th><th scope="col">Type</th><th scope="col">Confidence</th><th scope="col">Status</th><th scope="col">Updated</th></tr></thead><tbody>
              <tr><td><code>gross_revenue</code></td><td>Measure</td><td><span className="confidence high">High · 92%</span></td><td><Badge tone="success"><Icon name="check" />Approved</Badge></td><td>2 min ago</td></tr>
              <tr className="active-row"><td><code>active_customer</code></td><td>Dimension</td><td><span className="confidence mid">Medium · 68%</span></td><td><Badge tone="warning"><Icon name="info" />Needs review</Badge></td><td>18 min ago</td></tr>
              <tr><td><code>churn_risk</code></td><td>Measure</td><td><span className="confidence low">Low · 34%</span></td><td><Badge tone="danger"><Icon name="close" />Rejected</Badge></td><td>Yesterday</td></tr>
            </tbody></table></div>
          </Card>
          <Card>
            <div className="card-heading"><h3>Popover & tooltip</h3></div>
            <div className="popover-demo"><Button variant="outline"><Icon name="filter" />Filter assets</Button><div className="popover"><strong>Asset type</strong><label><input type="checkbox" defaultChecked /> Measures</label><label><input type="checkbox" /> Dimensions</label><Button size="sm">Apply filters</Button></div></div>
            <div className="tooltip-demo"><Button variant="ghost" size="icon" aria-label="More information"><Icon name="info" /></Button><span className="tooltip">View scoring guidance</span></div>
          </Card>
          <Card>
            <div className="card-heading"><h3>Loading & empty</h3></div>
            <div className="skeleton"><span /><span /><span /></div>
            <div className="empty"><div className="empty-icon"><Icon name="shield" size={32} /></div><h3>All caught up!</h3><p>There are no definitions waiting for review.</p><Button variant="outline">View approved assets</Button></div>
          </Card>
        </div>
      </section>
    </main>
    {toast && <div className="toast" role="status"><Icon name="check" /><div><strong>Campaign created</strong><span>Customer metrics is ready for reviewers.</span></div><Button variant="ghost" size="icon" aria-label="Close notification" onClick={() => setToast(false)}><Icon name="close" /></Button></div>}
  </div>
}

export default App
