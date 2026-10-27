import { useEffect, useState, type ReactNode } from 'react'
import { BrandIcon, BrandIllustration, BrandLogo } from '../components/BrandAssets'

type State = 'populated'|'loading'|'swipe-right'|'swipe-left'|'empty'|'session-complete'|'resurfaced'|'skip-reason-open'|'skipped-toast'|'edit-sheet'|'reject-sheet'|'submitting'|'error'|'vote-error'|'offline'|'shortcuts-dialog'
const iconPaths:Record<string,ReactNode>={
  check:<path d="m3 8 3 3 7-7"/>,close:<path d="m4 4 8 8M12 4l-8 8"/>,pencil:<path d="m3 13 1-3 7-7 2 2-7 7-3 1Z"/>,skip:<path d="m3 4 4 4-4 4M8 4l4 4-4 4"/>,
  measure:<><path d="M3 12V7M8 12V3M13 12V5"/><path d="M2 13h12"/></>,info:<><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5h.01"/></>,
  danger:<><path d="M8 2 14 13H2L8 2Z"/><path d="M8 6v3M8 11h.01"/></>,copy:<><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 10H2V3h7v1"/></>,
  play:<path d="m5 3 8 5-8 5V3Z"/>,trophy:<path d="M5 3h6v3a3 3 0 0 1-6 0V3Zm3 6v3M5 14h6M5 4H2v1a3 3 0 0 0 3 3M11 4h3v1a3 3 0 0 1-3 3"/>,
  menu:<path d="M2 4h12M2 8h12M2 12h12"/>,bell:<path d="M4 11h8l-1-2V6a3 3 0 0 0-6 0v3l-1 2Zm3 2h2"/>,moon:<path d="M12.5 10.5A5.5 5.5 0 0 1 5.5 3.5a5 5 0 1 0 7 7Z"/>,
  review:<><path d="M3 4h1M3 8h1M3 12h1M7 4h6M7 8h6M7 12h6"/></>,sparkle:<path d="m8 2 .8 3.2L12 6l-3.2.8L8 10l-.8-3.2L4 6l3.2-.8L8 2Z"/>,shield:<path d="M8 2.5 13 4v3.5c0 3-2 5-5 6-3-1-5-3-5-6V4l5-1.5Z"/>,chart:<path d="M3 12V8M8 12V3M13 12V6"/>,gear:<><circle cx="8" cy="8" r="2.5"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2"/></>,ranking:<path d="M3 4h7M3 8h10M3 12h5"/>
}
function Icon({name,size=16}:{name:string,size?:number}){return <BrandIcon name={name} size={size} fallback={iconPaths[name]} />}
const nav=[['Review','review'],['Leaderboard','ranking'],['Assistant','sparkle'],['Steward','shield'],['Executive','chart'],['Admin','gear']]
function Logo(){return <BrandLogo/>}

function App(){
  const [dark,setDark]=useState(false),[state,setState]=useState<State>('populated'),[logic,setLogic]=useState(false),[yaml,setYaml]=useState(false),[skipOpen,setSkipOpen]=useState(false),[announcement,setAnnouncement]=useState('')
  const modal=state==='edit-sheet'||state==='reject-sheet'||state==='shortcuts-dialog'
  const close=()=>{setState('populated');setSkipOpen(false)}
  const approve=()=>{if(state==='offline')return;setAnnouncement('Approved Readmission Rate (30-day)');setState('submitting');setTimeout(()=>setState('populated'),650)}
  const reject=()=>state!=='offline'&&setState('reject-sheet')
  const edit=()=>state!=='offline'&&setState('edit-sheet')
  const skip=()=>{if(state==='offline')return;setAnnouncement('Skipped Readmission Rate (30-day)');setState('skipped-toast');setSkipOpen(false)}
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName))return;if(e.key==='Escape'){close();return}if(modal)return
    if(e.key==='a'||e.key==='A'||e.key==='ArrowRight')approve();else if(e.key==='r'||e.key==='R'||e.key==='ArrowLeft')reject();else if(e.key==='e'||e.key==='E'||e.key==='ArrowUp')edit();else if(e.key==='s'&&!e.shiftKey)skip();else if(e.key==='S'||(e.key==='s'&&e.shiftKey)){setSkipOpen(true);setState('skip-reason-open')}else if(e.key==='l'||e.key==='L')setLogic(v=>!v);else if(e.key==='?')setState('shortcuts-dialog');else if(skipOpen&&['1','2','3','4'].includes(e.key))skip()}
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[modal,skipOpen,state])
  const disabled=state==='offline'||state==='submitting'
  return <div className={`app review-app ${dark?'dark':''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="shell-header" data-testid="shell-header-root"><div className="brand-bar"/><div className="header-inner">
      <button className="icon-button menu-button" aria-label="Open navigation"><Icon name="menu" size={20}/></button><a className="product-link" href="/review"><Logo/><span>Semantic Ground Truth</span></a>
      <nav className="desktop-nav" aria-label="Main navigation">{nav.map(([n,i])=><a key={n} className={n==='Review'?'active':''} href={n==='Steward'?'/steward':`/${n.toLowerCase()}`}><Icon name={i}/><span>{n}</span></a>)}</nav>
      <div className="header-actions"><button className="icon-button" aria-label="Notifications (2 unread)"><Icon name="bell" size={20}/><span className="bell-count">2</span></button><button className="icon-button" aria-label="Switch theme" onClick={()=>setDark(!dark)}><Icon name="moon" size={20}/></button><button className="account-trigger" aria-label="Account menu"><span className="avatar">PR</span></button></div>
    </div></header>
    {state==='offline'&&<div className="offline-banner"><Icon name="danger"/>You're offline. Votes and edits are paused until the connection is back.</div>}
    <main id="main-content" className="review-main">
      <h1 className="review-h1">Review</h1>
      <div className="review-toolbar">
        <label><span>Campaign</span><select data-testid="review-filters-campaign"><option>Q4 Clinical Quality certification</option></select></label>
        <label><span>Asset type</span><select data-testid="review-filters-asset-type"><option>All types</option><option>Measure</option><option>Dimension</option><option>Page</option><option>Domain</option><option>Subdomain</option></select></label>
        <div className="review-toolbar-meta"><span className="streak" data-testid="review-streak-badge"><Icon name="trophy"/>6-day streak</span><span data-testid="review-skip-counter">Skipped today: 3</span></div>
      </div>
      {state==='error'?<div className="inline-error"><Icon name="danger" size={24}/><div><strong>We couldn't load the next card.</strong><code>UPSTREAM_ERROR: SQL warehouse is starting.</code></div><button data-testid="review-error-retry" onClick={()=>setState('populated')}>Retry</button></div>
      :state==='empty'?<Empty/>
      :state==='session-complete'?<Complete/>
      :state==='loading'?<Loading/>
      :<>
        <article className={`asset-card ${state==='swipe-right'?'swipe right':''} ${state==='swipe-left'?'swipe left':''}`} data-testid="review-card-root" aria-disabled={state==='offline'}>
          {(state==='swipe-right'||state==='swipe-left')&&<div className="swipe-overlay"><Icon name={state==='swipe-right'?'check':'close'} size={72}/><strong>{state==='swipe-right'?'APPROVE':'REJECT'}</strong></div>}
          <div className="asset-top"><div className="badge-row"><span className="type-badge" data-testid="review-card-type-badge"><Icon name="measure"/>Measure</span><span className="pending" data-testid="review-card-status-badge">Pending</span>{state==='resurfaced'&&<span className="info-badge"><Icon name="info"/>You skipped this earlier</span>}</div><span className="domain">Clinical Quality / Outcomes</span></div>
          <h2 data-testid="review-card-title">Readmission Rate (30-day)</h2>
          <span className="campaign-chip">Q4 Clinical Quality certification</span>
          <p className="description">Percentage of discharged patients who are readmitted to any acute care facility within 30 days of their index discharge.</p>
          <div className="meter-block" data-testid="review-card-confidence"><div className="meter-label"><span>Confidence</span><strong>71% confidence · 11 votes</strong></div><div className="meter" role="meter" aria-label="Confidence 71%" aria-valuenow={71}><i/></div></div>
          <div className="progress-block" data-testid="review-card-progress"><div className="meter-label"><span>Campaign progress</span><strong>42 of 120 reviewed</strong></div><div className="progress" role="progressbar" aria-label="Review progress 42 of 120" aria-valuemin={0} aria-valuemax={120} aria-valuenow={42}><i/></div></div>
          <section className="card-section" data-testid="review-card-synonyms"><h3>Synonyms</h3><div className="synonyms">{['30-day readmit rate','Readmission %'].map(x=><span key={x}>{x}<button aria-label={`Approve ${x}`}><Icon name="check"/></button><button aria-label={`Reject ${x}`}><Icon name="close"/></button></span>)}<button className="add-chip">+ Add synonym</button></div></section>
          <section className="card-section" data-testid="review-card-examples"><h3>Use it in a sentence</h3><ul><li>How did 30-day readmission change this quarter?</li><li>Which service line has the highest readmission rate?</li></ul></section>
          <section className="disclosure"><button data-testid="review-card-logic-toggle" aria-expanded={logic} aria-label={logic?'Hide logic':'Show logic'} onClick={()=>setLogic(!logic)}><span>Logic</span><span>{logic?'−':'+'}</span></button>{logic&&<div className="logic-body"><p>Count patients readmitted within 30 calendar days of discharge, divided by all eligible discharges. Excludes planned readmissions.</p><button className="nested-toggle" onClick={()=>setYaml(!yaml)}>YAML definition <span>{yaml?'−':'+'}</span></button>{yaml&&<pre><button aria-label="Copy YAML"><Icon name="copy"/></button>{`measure: readmission_rate_30d\nformat: percentage\nnumerator: readmissions_30d\ndenominator: eligible_discharges`}</pre>}</div>}</section>
          <section className="query"><div><h3>Preview query</h3><button data-testid="review-card-query-run"><Icon name="play"/>Run</button></div><table><thead><tr><th scope="col">Quarter</th><th scope="col">Readmission rate</th></tr></thead><tbody><tr><td>2024 Q4</td><td>12.8%</td></tr><tr><td>2024 Q3</td><td>13.4%</td></tr></tbody></table></section>
        </article>
        <div className="vote-wrap">
          <div className="vote-bar">
            <button disabled={disabled} className="vote-action reject" data-testid="review-actions-reject" aria-label="Reject (R)" onClick={reject}>{state==='submitting'?<span className="spinner"/>:<Icon name="close" size={20}/>}<span>Reject</span></button>
            <button disabled={disabled} className="vote-action edit" data-testid="review-actions-edit" aria-label="Edit (E)" onClick={edit}><Icon name="pencil" size={20}/><span>Edit</span></button>
            <button disabled={disabled} className="vote-action approve" data-testid="review-actions-approve" aria-label="Approve (A)" onClick={approve}>{state==='submitting'?<span className="spinner"/>:<Icon name="check" size={20}/>}<span>Approve</span></button>
            <div className="skip-group"><button disabled={disabled} className="vote-action skip" data-testid="review-actions-skip" aria-label="Skip (S)" onClick={skip}><Icon name="skip" size={20}/><span>Skip</span></button><button disabled={disabled} className="reason-trigger" data-testid="review-actions-skip-reason" aria-label="Choose a skip reason" onClick={()=>{setSkipOpen(!skipOpen);setState('skip-reason-open')}}>⌄</button>
            {skipOpen&&<SkipPopover onSkip={skip}/>}</div>
          </div>
          <p className="keyboard-hints">A approve · R reject · E edit · S skip · ? shortcuts</p>
          {state==='offline'&&<span className="offline-tip">You're offline</span>}
        </div>
      </>}
      <StatePicker state={state} setState={(s)=>{setState(s);setSkipOpen(s==='skip-reason-open')}}/>
    </main>
    {(state==='skipped-toast'||state==='vote-error')&&<div className={`review-toast ${state==='vote-error'?'error':''}`} role="status"><Icon name={state==='vote-error'?'danger':'skip'}/><span>{state==='vote-error'?"Your vote wasn't saved. Try again.":"Skipped. You'll see it again in 24 h"}</span><button aria-label="Close" onClick={close}>×</button></div>}
    {(state==='edit-sheet'||state==='reject-sheet')&&<Sheet kind={state==='edit-sheet'?'edit':'reject'} close={close}/>}
    {state==='shortcuts-dialog'&&<Shortcuts close={close}/>}
    <div className="sr-only" aria-live="polite" data-testid="review-live-region">{announcement}</div>
    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.slice(0,4).map(([n,i])=><a key={n} className={n==='Review'?'active':''} href={n==='Steward'?'/steward':`/${n.toLowerCase()}`}><Icon name={i} size={20}/><span>{n}</span></a>)}</nav>
  </div>
}

function SkipPopover({onSkip}:{onSkip:()=>void}){const opts=[['1','Not sure','not_sure'],['2','Not my area','not_my_area'],['3','Need more context','need_context'],['4','Other','other']];return <div className="skip-popover"><h3>Why skip?</h3>{opts.map(([k,t,r])=><button key={r} data-testid="review-skip-reason-option" data-reason={r} onClick={onSkip}><kbd>{k}</kbd>{t}</button>)}<p>Skipping doesn't count as a vote. You'll see this again in 24 hours.</p></div>}
function Sheet({kind,close}:{kind:'edit'|'reject',close:()=>void}){const [text,setText]=useState('');return <><button className="modal-scrim" aria-label="Close" onClick={close}/><aside className="review-sheet" role="dialog" aria-modal="true" aria-label={kind==='edit'?'Edit definition':'Reject definition'}><div className="sheet-head"><div><p className="eyebrow">{kind==='edit'?'PROPOSE A CHANGE':'SEND FEEDBACK'}</p><h2>{kind==='edit'?'Edit definition':'Reject definition'}</h2></div><button aria-label="Close" onClick={close}>×</button></div>{kind==='edit'?<div className="form-stack"><label>Display name<input defaultValue="Readmission Rate (30-day)"/></label><label>Description<textarea defaultValue="Percentage of discharged patients who are readmitted to any acute care facility within 30 days of their index discharge."/></label><label>Plain-English logic<textarea defaultValue="Count patients readmitted within 30 calendar days of discharge, divided by all eligible discharges. Excludes planned readmissions."/></label></div>:<label>What's wrong? <span className="optional">Optional</span><textarea maxLength={4000} value={text} onChange={e=>setText(e.target.value)} placeholder="Help the steward understand what needs attention"/><small>{text.length} / 4000</small></label>}<div className="sheet-actions"><button onClick={close}>Cancel</button><button className={kind==='reject'?'destructive':''} data-testid={kind==='edit'?'review-edit-sheet-submit':'review-reject-sheet-submit'}>{kind==='edit'?'Submit edit':<><Icon name="close"/>Reject</>}</button></div></aside></>}
function Shortcuts({close}:{close:()=>void}){return <><button className="modal-scrim" aria-label="Close" onClick={close}/><section className="shortcut-dialog" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><div className="sheet-head"><h2>Keyboard shortcuts</h2><button aria-label="Close" onClick={close}>×</button></div><table><tbody>{[['A / →','Approve'],['R / ←','Reject'],['E / ↑','Edit'],['S','Skip'],['Shift + S','Skip with reason'],['L','Toggle logic'],['?','Show shortcuts'],['Esc','Close']].map(([k,a])=><tr key={k}><td><kbd>{k}</kbd></td><td>{a}</td></tr>)}</tbody></table></section></>}
function Empty(){return <section className="state-card" data-testid="review-empty-root"><span className="state-icon"><BrandIllustration name="data-quality-3"/></span><h2>All caught up!</h2><p>There's nothing waiting for your review in this campaign.</p><div><button>Switch campaign</button><button className="primary">View leaderboard</button></div></section>}
function Complete(){return <section className="state-card" data-testid="review-session-complete-root"><span className="state-icon"><Icon name="trophy" size={36}/></span><h2>Nice work, 20 cards reviewed</h2><p>Your feedback makes these definitions more useful.</p><div className="stats"><span><strong>17</strong>reviewed</span><span><strong>3</strong>skipped</span></div><div><button>Done for now</button><button className="primary">Keep going</button></div></section>}
function Loading(){return <><div className="asset-card loading-card"><i/><i/><i/><i/><i/></div><div className="loading-actions"><i/><i/><i/><i/></div></>}
function StatePicker({state,setState}:{state:State,setState:(s:State)=>void}){const all:State[]=['populated','loading','swipe-right','swipe-left','empty','session-complete','resurfaced','skip-reason-open','skipped-toast','edit-sheet','reject-sheet','submitting','error','vote-error','offline','shortcuts-dialog'];return <aside className="state-switcher"><strong>Preview state</strong><div>{all.map(s=><button key={s} className={state===s?'active':''} onClick={()=>setState(s)}>{s}</button>)}</div></aside>}
export default App
