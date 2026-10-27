import { useState, type ReactNode } from 'react'
import { BrandIcon, BrandIllustration, BrandLogo, BrandProductIcon } from '../components/BrandAssets'

type PageState = 'populated' | 'loading' | 'empty' | 'dashboard-unconfigured' | 'error' | 'forbidden' | 'offline'
const paths: Record<string, ReactNode> = {
  review:<path d="M3 4h1M3 8h1M3 12h1M7 4h6M7 8h6M7 12h6"/>,
  ranking:<path d="M3 4h7M3 8h10M3 12h5"/>,
  sparkle:<path d="m8 2 .8 3.2L12 6l-3.2.8L8 10l-.8-3.2L4 6l3.2-.8L8 2Z"/>,
  shield:<path d="M8 2.5 13 4v3.5c0 3-2 5-5 6-3-1-5-3-5-6V4l5-1.5Z"/>,
  chart:<path d="M3 12V8M8 12V3M13 12V6"/>,
  gear:<><circle cx="8" cy="8" r="2.5"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2"/></>,
  bell:<path d="M4 11h8l-1-2V6a3 3 0 0 0-6 0v3l-1 2Zm3 2h2"/>,
  moon:<path d="M12.5 10.5A5.5 5.5 0 0 1 5.5 3.5a5 5 0 1 0 7 7Z"/>,
  menu:<path d="M2 4h12M2 8h12M2 12h12"/>,
  up:<path d="M8 13V3M4 7l4-4 4 4"/>,
  down:<path d="M8 3v10M4 9l4 4 4-4"/>,
  external:<path d="M8 3h5v5M13 3 7 9M11 9v4H3V5h4"/>,
  dashboards:<><rect x="2" y="3" width="5" height="4" rx=".5"/><rect x="9" y="3" width="5" height="7" rx=".5"/><rect x="2" y="9" width="5" height="4" rx=".5"/><rect x="9" y="12" width="5" height="1" rx=".5"/></>,
  lock:<><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></>,
  governance:<><path d="M8 2 14 5 8 8 2 5l6-3Z"/><path d="M3 7v4l5 3 5-3V7"/></>,
  danger:<><path d="M8 2 14 13H2L8 2Z"/><path d="M8 6v3M8 11h.01"/></>,
  cloud:<><path d="M5 12H4a3 3 0 0 1-.8-5.9A4.5 4.5 0 0 1 11 4.4 3.5 3.5 0 0 1 13 11"/><path d="m2 2 12 12"/></>,
}
function Icon({name,size=16}:{name:string,size?:number}){return <BrandIcon name={name} size={size} fallback={paths[name]} />}
function Logo(){return <BrandLogo/>}
function AiBiIcon(){return <BrandProductIcon file="ai-bi-icon-full-color.svg" label="AI/BI" className="aibi-icon"/>}
const nav=[['Review','review'],['Leaderboard','ranking'],['Assistant','sparkle'],['Steward','shield'],['Executive','chart'],['Admin','gear']]
const kpis=[
  {label:'Coverage',value:'35%',test:'executive-kpi-coverage',progress:35,delta:'+4 pts vs last week',trend:'up'},
  {label:'Certification',value:'15%',test:'executive-kpi-certification',progress:15,delta:'-2 pts',trend:'down'},
  {label:'Active reviewers (7d)',value:'23',test:'executive-kpi-active-reviewers'},
  {label:'Votes (7d)',value:'611',test:'executive-kpi-votes'},
  {label:'Active campaigns',value:'3',test:'executive-kpi-active-campaigns'},
  {label:'Total assets',value:'120',test:'executive-kpi-total-assets'},
]

export default function App(){
  const [dark,setDark]=useState(false)
  const [state,setState]=useState<PageState>('populated')
  return <div className={`app executive-app ${dark?'dark':''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="shell-header"><div className="brand-bar"/><div className="header-inner">
      <button className="icon-button menu-button" aria-label="Open navigation"><Icon name="menu" size={20}/></button>
      <a className="product-link" href="/review"><Logo/><span>Semantic Ground Truth</span></a>
      <nav className="desktop-nav" aria-label="Main navigation">{nav.map(([name,icon])=><a key={name} className={name==='Executive'?'active':''} href={name==='Steward'?'/steward':`/${name.toLowerCase()}`}><Icon name={icon}/><span>{name}</span></a>)}</nav>
      <div className="header-actions"><button className="icon-button" aria-label="Notifications (2 unread)"><Icon name="bell" size={20}/><span className="bell-count">2</span></button><button className="icon-button" aria-label="Switch theme" onClick={()=>setDark(!dark)}><Icon name="moon" size={20}/></button><button className="account-trigger" aria-label="Account menu"><span className="avatar">PR</span></button></div>
    </div></header>
    {state==='offline'&&<div className="offline-banner"><Icon name="cloud" size={20}/><span><strong>You're offline.</strong> Showing the latest available executive metrics.</span></div>}
    <main id="main-content" className="executive-main">
      <div className="executive-heading"><p className="eyebrow">ORGANIZATION OVERVIEW</p><h1>Executive summary</h1><p>Semantic asset coverage and certification</p>{state==='offline'&&<span>Last updated 5 min ago</span>}</div>
      {state==='forbidden'?<Forbidden/>:state==='empty'?<Empty/>:state==='error'?<ErrorState retry={()=>setState('populated')}/>:<>
        {state==='loading'?<KpiLoading/>:<section className="kpi-grid">{kpis.map(kpi=><article className="kpi-card" role="group" aria-label={kpi.label} data-testid={kpi.test} key={kpi.label}>
          <div className="kpi-top"><span>{kpi.label}</span>{kpi.progress!==undefined&&<span className={`delta ${kpi.trend}`}><Icon name={kpi.trend}/>{kpi.delta}</span>}</div>
          <div className="kpi-value">{kpi.value}</div>
          {kpi.progress!==undefined?<div className="kpi-progress" aria-hidden="true"><i style={{width:`${kpi.progress}%`}}/></div>:<p>{kpi.label==='Active reviewers (7d)'?'Across 4 active teams':kpi.label==='Votes (7d)'?'87 more than last week':kpi.label==='Active campaigns'?'2 certification · 1 review':'42 reviewed this quarter'}</p>}
        </article>)}</section>}
        <section className="dashboard-card">
          <div className="dashboard-copy"><AiBiIcon/><div><h2>Detailed dashboard</h2><p>{state==='dashboard-unconfigured'?"The dashboard link isn't configured for this environment.":'Explore trends by domain, campaign, asset type and reviewer activity in AI/BI.'}</p></div></div>
          {state!=='dashboard-unconfigured'&&<a href="#dashboard" target="_blank" rel="noreferrer" data-testid="executive-dashboard-link" aria-label="Open AI/BI dashboard (opens in a new tab)">Open AI/BI dashboard <Icon name="external"/></a>}
        </section>
      </>}
      <aside className="state-switcher"><strong>Preview state</strong><div>{(['populated','loading','empty','dashboard-unconfigured','error','forbidden','offline'] as PageState[]).map(value=><button key={value} className={state===value?'active':''} onClick={()=>setState(value)}>{value}</button>)}</div></aside>
    </main>
    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.slice(0,4).map(([name,icon])=><a key={name} href={name==='Steward'?'/steward':`/${name.toLowerCase()}`}><Icon name={icon} size={20}/><span>{name}</span></a>)}</nav>
  </div>
}
function KpiLoading(){return <section className="kpi-grid">{Array.from({length:6}).map((_,i)=><article className="kpi-card kpi-skeleton" key={i}><i/><i/><i/></article>)}</section>}
function Empty(){return <section className="executive-state" data-testid="executive-empty-root"><span className="executive-state-icon"><BrandIllustration name="dashboards"/></span><h2>No assets yet</h2><p>Import semantic assets before tracking coverage and certification.</p><a href="#steward">Import assets</a></section>}
function Forbidden(){return <section className="executive-state" data-testid="executive-forbidden-root"><span className="executive-state-icon"><BrandIllustration name="governance"/><i><Icon name="lock"/></i></span><h2>Steward access required</h2><p>Ask an admin to add you to semantic-ground-truth-stewards.</p></section>}
function ErrorState({retry}:{retry:()=>void}){return <section className="executive-error"><Icon name="danger" size={24}/><div><strong>We couldn't load the executive summary</strong><p>Your data is unchanged. Try loading these metrics again.</p></div><button onClick={retry}>Retry</button></section>}
