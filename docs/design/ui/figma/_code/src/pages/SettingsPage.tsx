import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

type Theme='light'|'dark'|'system'
type Density='comfortable'|'compact'
type Motion='system'|'reduce'|'full'
type PageState='populated'|'loading'|'defaults'|'dirty'|'saving'|'saved'|'validation-error'|'error'|'save-error'|'offline'
const paths:Record<string,ReactNode>={
  review:<path d="M3 4h1M3 8h1M3 12h1M7 4h6M7 8h6M7 12h6"/>,ranking:<path d="M3 4h7M3 8h10M3 12h5"/>,sparkle:<path d="m8 2 .8 3.2L12 6l-3.2.8L8 10l-.8-3.2L4 6l3.2-.8L8 2Z"/>,shield:<path d="M8 2.5 13 4v3.5c0 3-2 5-5 6-3-1-5-3-5-6V4l5-1.5Z"/>,chart:<path d="M3 12V8M8 12V3M13 12V6"/>,gear:<><circle cx="8" cy="8" r="2.5"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2"/></>,bell:<path d="M4 11h8l-1-2V6a3 3 0 0 0-6 0v3l-1 2Zm3 2h2"/>,moon:<path d="M12.5 10.5A5.5 5.5 0 0 1 5.5 3.5a5 5 0 1 0 7 7Z"/>,menu:<path d="M2 4h12M2 8h12M2 12h12"/>,
  sun:<><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M13 3l-1.5 1.5M4.5 11.5 3 13"/></>,monitor:<><rect x="2" y="3" width="12" height="8" rx="1"/><path d="M6 14h4M8 11v3"/></>,rows:<path d="M3 4h10M3 8h10M3 12h10"/>,motion:<path d="M2 5h8M5 8h9M2 11h8"/>,check:<path d="m3 8 3 3 7-7"/>,info:<><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5h.01"/></>,danger:<><path d="M8 2 14 13H2L8 2Z"/><path d="M8 6v3M8 11h.01"/></>,cloud:<><path d="M5 12H4a3 3 0 0 1-.8-5.9A4.5 4.5 0 0 1 11 4.4 3.5 3.5 0 0 1 13 11"/><path d="m2 2 12 12"/></>
}
function Icon({name,size=16}:{name:string,size?:number}){return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>}
function Logo(){return <span className="db-logo" aria-hidden="true"><i/><i/><i/></span>}
const nav=[['Review','review'],['Leaderboard','ranking'],['Assistant','sparkle'],['Steward','shield'],['Executive','chart'],['Admin','gear']]
const events=[['asset_certified','Asset certified'],['campaign_created','Campaign created'],['campaign_completed','Campaign completed'],['vote_milestone','Vote milestone'],['feedback_branch_ready','Feedback branch ready'],['feedback_failed','Feedback failed']]

export default function App(){
  const [theme,setTheme]=useState<Theme>('system'),[density,setDensity]=useState<Density>('comfortable'),[motion,setMotion]=useState<Motion>('system'),[state,setState]=useState<PageState>('populated'),[cards,setCards]=useState('20'),[hints,setHints]=useState(true)
  const [notifications,setNotifications]=useState<Record<string,{inApp:boolean,digest:boolean}>>(()=>Object.fromEntries(events.map(([id])=>[id,{inApp:true,digest:id==='campaign_completed'}])))
  const actualDark=theme==='dark'||(theme==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)
  const dirty=state==='dirty'||state==='saving'||state==='validation-error'||state==='save-error'
  const markDirty=()=>{if(state!=='offline')setState('dirty')}
  const save=()=>{if(state==='offline')return;if(Number(cards)<5||Number(cards)>100){setState('validation-error');return}setState('saving');setTimeout(()=>setState('saved'),650)}
  useEffect(()=>{const key=(e:globalThis.KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[cards,state])
  const selectTheme=(value:Theme)=>{setTheme(value);if(state!=='offline')markDirty()}
  return <div className={`app settings-app ${actualDark?'dark':''} ${density}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="shell-header"><div className="brand-bar"/><div className="header-inner"><button className="icon-button menu-button" aria-label="Open navigation"><Icon name="menu" size={20}/></button><a className="product-link" href="/review"><Logo/><span>Semantic Ground Truth</span></a><nav className="desktop-nav" aria-label="Main navigation">{nav.map(([n,i])=><a key={n} href={n==='Steward'?'/steward':`/${n.toLowerCase()}`}><Icon name={i}/><span>{n}</span></a>)}</nav><div className="header-actions"><button className="icon-button" aria-label="Notifications (2 unread)"><Icon name="bell" size={20}/><span className="bell-count">2</span></button><button className="icon-button" aria-label="Theme settings"><Icon name={theme==='light'?'sun':theme==='dark'?'moon':'monitor'} size={20}/></button><button className="account-trigger" aria-label="Account menu"><span className="avatar">PR</span></button></div></div></header>
    {state==='offline'&&<div className="offline-banner"><Icon name="cloud" size={20}/><span><strong>You're offline.</strong> Settings are read-only, but theme changes still apply on this device.</span></div>}
    <main id="main-content" className="settings-main">
      <div className="settings-heading"><p className="eyebrow">YOUR PREFERENCES</p><h1>Settings</h1><p>Make Semantic Ground Truth work the way you do.</p></div>
      {state==='error'?<LoadError retry={()=>setState('populated')}/>:state==='loading'?<SettingsLoading/>:<div className="settings-layout">
        <nav className="settings-index" aria-label="Settings sections">{['Appearance','Motion','Review','Notifications','About'].map((x,i)=><a key={x} className={i===0?'active':''} href={`#settings-${x.toLowerCase()}`}>{x}</a>)}</nav>
        <div className="settings-content" aria-disabled={state==='offline'}>
          {state==='defaults'&&<div className="defaults-note"><Icon name="info"/>You're using the default settings</div>}
          {state==='save-error'&&<div className="settings-alert"><Icon name="danger"/>We couldn't save your settings. Check your connection and try again.</div>}
          <section className="settings-section" id="settings-appearance"><SectionHead title="Appearance" copy="Choose how the app looks and how much content fits on screen."/>
            <Segmented legend="Theme" value={theme} options={[['light','Light','sun'],['dark','Dark','moon'],['system','System','monitor']]} testPrefix="settings-theme" onChange={v=>selectTheme(v as Theme)}/>
            <div className={`theme-preview ${actualDark?'preview-dark':''}`}><div className="mini-shell"><Logo/><span>Review</span></div><div className="mini-review"><span>MEASURE</span><strong>Readmission Rate</strong><p>Patients readmitted within 30 days.</p><i/></div></div>
            <Segmented legend="Density" value={density} options={[['comfortable','Comfortable','rows'],['compact','Compact','rows']]} testPrefix="settings-density" disabled={state==='offline'} onChange={v=>{setDensity(v as Density);markDirty()}}/>
            <div className={`density-preview ${density}`}><span className="mini-avatar">PR</span><strong>Readmission Rate (30-day)</strong><span>71%</span></div>
          </section>
          <section className="settings-section" id="settings-motion"><SectionHead title="Motion" copy="Control animation and state transitions."/>
            <Segmented legend="Motion" value={motion} options={[['system','System','monitor'],['reduce','Reduce','motion'],['full','Full','sparkle']]} testPrefix="settings-motion" disabled={state==='offline'} onChange={v=>{setMotion(v as Motion);markDirty()}}/>
            <p className="settings-help">System follows your device's reduced-motion setting. Full never overrides a device that asks for reduced motion.</p>
          </section>
          <section className="settings-section" id="settings-review"><SectionHead title="Review" copy="Set defaults for your review sessions."/>
            <div className="review-settings-grid"><label>Default campaign<select disabled={state==='offline'} data-testid="settings-review-default-campaign" onChange={markDirty}><option>Q4 Clinical Quality certification</option><option>Finance metrics refresh</option></select></label><label>Default asset type<select disabled={state==='offline'} data-testid="settings-review-default-asset-type" onChange={markDirty}><option>All types</option><option>Measure</option><option>Dimension</option></select></label></div>
            <label className="cards-setting">Cards per session<div><input disabled={state==='offline'} className={state==='validation-error'?'invalid':''} type="number" min="5" max="100" value={state==='validation-error'?'150':cards} onChange={e=>{setCards(e.target.value);setState('dirty')}} data-testid="settings-review-cards-per-session"/><input disabled={state==='offline'} type="range" min="5" max="100" value={Math.min(Number(cards),100)} onChange={e=>{setCards(e.target.value);markDirty()}}/></div><small>Choose 5 to 100 cards per session.</small>{state==='validation-error'&&<em>Enter a number from 5 to 100</em>}</label>
            <Switch label="Show keyboard hints" checked={hints} disabled={state==='offline'} testId="settings-review-keyboard-hints" onChange={()=>{setHints(!hints);markDirty()}}/>
          </section>
          <section className="settings-section" id="settings-notifications"><SectionHead title="Notifications" copy="Choose which events you want to hear about."/>
            <div className="notifications-table"><table><thead><tr><th scope="col">Event</th><th scope="col">In-app</th><th scope="col">Slack</th><th scope="col">Teams</th><th scope="col">Webhook</th><th scope="col">Daily digest</th></tr></thead><tbody>{events.map(([id,label])=><tr key={id} data-testid="settings-notifications-row" data-event-type={id}><td><strong>{label}</strong></td><td><Switch label={`${label} in-app`} compact checked={notifications[id].inApp} disabled={state==='offline'} onChange={()=>{setNotifications({...notifications,[id]:{...notifications[id],inApp:!notifications[id].inApp}});markDirty()}}/></td>{['Slack','Teams','Webhook'].map(channel=><td key={channel}><span className="coming-wrap"><button disabled aria-label={`${label} ${channel}, coming later`}>—</button><span className="coming-tooltip">Coming later</span></span></td>)}<td><Switch label={`${label} daily digest`} compact checked={notifications[id].digest} disabled={state==='offline'} onChange={()=>{setNotifications({...notifications,[id]:{...notifications[id],digest:!notifications[id].digest}});markDirty()}}/></td></tr>)}</tbody></table></div>
          </section>
          <section className="settings-section" id="settings-about"><SectionHead title="About" copy="Your account and access."/><div className="about-user"><span className="avatar large">PR</span><div><strong>Priya Raman</strong><span>priya.raman@example.com</span></div><div className="about-roles"><span>reviewer</span><span>steward</span></div></div></section>
        </div>
      </div>}
      <aside className="state-switcher"><strong>Preview state</strong><div>{(['populated','loading','defaults','dirty','saving','saved','validation-error','error','save-error','offline'] as PageState[]).map(s=><button key={s} className={state===s?'active':''} onClick={()=>setState(s)}>{s}</button>)}</div></aside>
    </main>
    {dirty&&<footer className="settings-footer"><span>{state==='saving'?'Saving changes…':'You have unsaved changes'}</span><div><button data-testid="settings-footer-discard" disabled={state==='saving'} onClick={()=>{setCards('20');setState('populated')}}>Discard</button><button className="primary" data-testid="settings-footer-save" disabled={state==='saving'||state==='offline'} onClick={save}>{state==='saving'&&<span className="spinner"/>}Save changes</button></div></footer>}
    {state==='saved'&&<div className="settings-toast" role="status"><Icon name="check"/><strong>Settings saved</strong><button aria-label="Close" onClick={()=>setState('populated')}>×</button></div>}
    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.slice(0,4).map(([n,i])=><a key={n} href={n==='Steward'?'/steward':`/${n.toLowerCase()}`}><Icon name={i} size={20}/><span>{n}</span></a>)}</nav>
  </div>
}
function SectionHead({title,copy}:{title:string,copy:string}){return <div className="settings-section-head"><h2>{title}</h2><p>{copy}</p></div>}
function Segmented({legend,value,options,testPrefix,onChange,disabled=false}:{legend:string,value:string,options:string[][],testPrefix:string,onChange:(v:string)=>void,disabled?:boolean}){
  const refs=useRef<(HTMLButtonElement|null)[]>([])
  const move=(e:KeyboardEvent,index:number)=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const forward=['ArrowRight','ArrowDown'].includes(e.key);const next=forward?(index+1)%options.length:(index+options.length-1)%options.length;onChange(options[next][0]);refs.current[next]?.focus()}
  return <fieldset className="segmented-field"><legend>{legend}</legend><div className="segmented" role="radiogroup" aria-label={legend}>{options.map(([id,label,icon],i)=><button key={id} disabled={disabled} ref={el=>{refs.current[i]=el}} role="radio" aria-checked={value===id} tabIndex={value===id?0:-1} data-testid={`${testPrefix}-${id}`} onClick={()=>onChange(id)} onKeyDown={e=>move(e,i)}><Icon name={icon}/>{label}</button>)}</div></fieldset>
}
function Switch({label,checked,onChange,disabled=false,testId,compact=false}:{label:string,checked:boolean,onChange:()=>void,disabled?:boolean,testId?:string,compact?:boolean}){return <label className={`settings-switch-row ${compact?'compact':''}`}><span className={compact?'sr-only':''}>{label}</span><button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} data-testid={testId} className={`settings-switch ${checked?'on':''}`} onClick={onChange}><i/></button></label>}
function SettingsLoading(){return <div className="settings-loading"><aside>{Array.from({length:5}).map((_,i)=><i key={i}/>)}</aside><div>{Array.from({length:5}).map((_,i)=><section key={i}><i/><i/><i/></section>)}</div></div>}
function LoadError({retry}:{retry:()=>void}){return <section className="settings-error"><Icon name="danger" size={24}/><div><strong>We couldn't load your settings</strong><p>Your saved preferences haven't changed.</p></div><button onClick={retry}>Retry</button></section>}
