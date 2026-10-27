import { useState, type ReactNode } from 'react'
import { BrandIcon, BrandIllustration, BrandLogo } from '../components/BrandAssets'

type Page = 'not-found' | 'app-error'
const paths: Record<string, ReactNode> = {
  catalog: <><path d="M3 4c0-1 2.2-2 5-2s5 1 5 2-2.2 2-5 2-5-1-5-2Z" /><path d="M3 4v4c0 1 2.2 2 5 2s5-1 5-2V4M3 8v4c0 1 2.2 2 5 2s5-1 5-2V8" /></>,
  danger: <><path d="M8 2 14 13H2L8 2Z" /><path d="M8 6v3M8 11h.01" /></>,
  back: <path d="m9 3-5 5 5 5M4 8h9" />,
  reload: <><path d="M13 5V2l-1 1A6 6 0 1 0 13 10" /><path d="M13 2h-3" /></>,
  copy: <><rect x="5" y="5" width="8" height="8" rx="1" /><path d="M3 10H2V3h7v1" /></>,
  chevron: <path d="m5 6 3 3 3-3" />,
  moon: <path d="M12.5 10.5A5.5 5.5 0 0 1 5.5 3.5a5 5 0 1 0 7 7Z" />,
  sun: <><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M13 3l-1.5 1.5M4.5 11.5 3 13" /></>,
  check: <path d="m3 8 3 3 7-7" />,
}
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return <BrandIcon name={name} size={size} fallback={paths[name]} />
}
function Logo() { return <BrandLogo /> }

export default function App({ initialPage = 'not-found' }: { initialPage?: Page }) {
  const [page, setPage] = useState<Page>(initialPage)
  const [dark, setDark] = useState(false)
  const [details, setDetails] = useState(false)
  const [copied, setCopied] = useState(false)
  const errorDetails = `Error: Failed to render SemanticAssetDetail
    at SemanticAssetDetail (src/pages/assets/detail.tsx:84:17)
    at Suspense
    at StewardLayout (src/layouts/steward.tsx:41:9)
    at AppRouter (src/router.tsx:112:5)

Caused by: TypeError: Cannot read properties of undefined (reading 'display_name')`
  const copy = () => {
    navigator.clipboard?.writeText(errorDetails)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  return <div className={`app fallback-app ${dark ? 'dark' : ''}`}>
    <header className="fallback-header">
      <a href="/review" className="product-link"><Logo /><span>Semantic Ground Truth</span></a>
      <button className="icon-button" aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} onClick={() => setDark(!dark)}><Icon name={dark ? 'sun' : 'moon'} size={20} /></button>
    </header>
    <main className="fallback-main">
      {page === 'not-found' ? <section className="fallback-card" data-testid="not-found-root">
        <span className="fallback-icon catalog-icon"><BrandIllustration name="unity-catalog" /></span>
        <p className="fallback-code">404</p>
        <h1>Page not found</h1>
        <p className="fallback-copy">The page you're looking for doesn't exist or moved.</p>
        <a className="fallback-primary" href="#review" data-testid="not-found-home-link"><Icon name="back" />Back to Review</a>
      </section> : <section className="fallback-card error-card" data-testid="app-error-root">
        <span className="fallback-icon danger-icon"><Icon name="danger" size={38} /></span>
        <p className="fallback-code">APPLICATION ERROR</p>
        <h1>Something went wrong</h1>
        <p className="fallback-copy">Reload the page to try again. If it keeps happening, share the details below with your admin.</p>
        <div className="error-actions">
          <button className="fallback-primary" data-testid="app-error-reload" onClick={() => window.location.reload()}><Icon name="reload" />Reload</button>
          <button className="fallback-secondary" onClick={copy}>{copied ? <Icon name="check" /> : <Icon name="copy" />}{copied ? 'Details copied' : 'Copy details'}</button>
        </div>
        <div className="technical-disclosure">
          <button aria-expanded={details} data-testid="app-error-details-toggle" onClick={() => setDetails(!details)}><span>Technical details</span><Icon name="chevron" /></button>
          {details && <pre>{errorDetails}</pre>}
        </div>
      </section>}
    </main>
    <aside className="fallback-preview" aria-label="Fallback page preview">
      <span>Preview</span>
      <button className={page === 'not-found' ? 'active' : ''} onClick={() => setPage('not-found')}>404</button>
      <button className={page === 'app-error' ? 'active' : ''} onClick={() => setPage('app-error')}>App error</button>
    </aside>
    {copied && <div className="fallback-toast" role="status"><Icon name="check" />Technical details copied</div>}
  </div>
}
