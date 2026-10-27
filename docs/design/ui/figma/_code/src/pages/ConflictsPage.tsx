import { useEffect, useRef, useState, type ReactNode } from 'react'

type PageState='populated'|'loading'|'empty'|'resolving'|'resolved-toast'|'stale'|'reject-all-confirm'|'error'|'forbidden'|'offline'
const paths:Record<string,ReactNode>={
  review:<path d="M3 4h1M3 8h1M3 12h1M7 4h6M7 8h6M7 12h6"/>,ranking:<path d="M3 4h7M3 8h10M3 12h5"/>,sparkle:<path d="m8 2 .8 3.2L12 6l-3.2.8L8 10l-.8-3.2L4 6l3.2-.8L8 2Z"/>,shield:<path d="M8 2.5 13 4v3.5c0 3-2 5-5 6-3-1-5-3-5-6V4l5-1.5Z"/>,chart:<path d="M3 12V8M8 12V3M13 12V6"/>,gear:<><circle cx="8" cy="8" r="2.5"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2"/></>,bell:<path d="M4 11h8l-1-2V6a3 3 0 0 0-6 0v3l-1 2Zm3 2h2"/>,moon:<path d="M12.5 10.5A5.5 5.5 0 0 1 5.5 3.5a5 5 0 1 0 7 7Z"/>,menu:<path d="M2 4h12M2 8h12M2 12h12"/>,
  check:<path d="m3 8 3 3 7-7"/>,close:<path d="m4 4 8 8M12 4l-8 8"/>,users:<><circle cx="6" cy="5" r="2.5"/><path d="M2 13c.4-2.4 1.7-3.5 4-3.5s3.6 1.1 4 3.5M10 4.2c2.1-.2 3.2.8 3.2 2.3S12.3 9 10.8 9"/></>,danger:<><path d="M8 2 14 13H2L8 2Z"/><path d="M8 6v3M8 11h.01"/></>,refresh:<><path d="M13 5V2l-1 1A6 6 0 1 0 13 10"/><path d="M13 2h-3"/></>,lock:<><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></>,cloud:<><path d="M5 12H4a3 3 0 0 1-.8-5.9A4.5 4.5 0 0 1 11 4.4 3.5 3.5 0 0 1 13 11"/><path d="m2 2 12 12"/></>,back:<path d="m10 3-5 5 5 5"/>
}
function Icon({name,size=16}:{name:string,size?:number}){return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>}
function Logo(){return <span className="db-logo" aria-hidden="true"><i/><i/><i/></span>}
const nav=[['Review','review'],['Leaderboard','ranking'],['Assistant','sparkle'],['Steward','shield'],['Executive','chart'],['Admin','gear']]
const conflicts=[
  {id:'readmission-rate',name:'Readmission Rate (30-day)',count:'2 proposals · 2 rejects',age:'2h'},
  {id:'ed-boarding-hours',name:'ED Boarding Hours',count:'3 proposals · 1 reject',age:'5h'},
  {id:'discharge-disposition',name:'Discharge Disposition',count:'2 proposals · 3 rejects',age:'1d'},
]
const proposals=[
  {id:'vote-ana',initials:'AD',name:'Ana Duarte',time:'2 hours ago',content:<><span>Percentage of discharged patients who are readmitted to </span><del>any acute care facility</del><ins>the same or another acute care hospital</ins><span> within 30 days of their index discharge.</span></>},
  {id:'vote-sam',initials:'SO',name:'Sam Okafor',time:'3 hours ago',content:<><span>Percentage of </span><ins>eligible adult</ins><span> discharged patients who are readmitted to any acute care facility within </span><del>30 days</del><ins>30 calendar days</ins><span> of their index discharge, excluding planned readmissions.</span></>},
]
export default function App(){
  const [dark,setDark]=useState(false),[state,setState]=useState<PageState>('populated'),[selectedGroup,setSelectedGroup]=useState(0),[selectedProposal,setSelectedProposal]=useState('vote-ana'),[mobileDetail,setMobileDetail]=useState(false)
  const noteRef=useRef<HTMLTextAreaElement>(null),listRefs=useRef<(HTMLButtonElement|null)[]>([])
  const disabled=state==='resolving'||state==='offline'||state==='stale'
  const resolve=()=>{if(disabled)return;setState('resolving');setTimeout(()=>setState('resolved-toast'),700)}
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName))return
    if(e.key.toLowerCase()==='j'){e.preventDefault();const n=Math.min(selectedGroup+1,conflicts.length-1);setSelectedGroup(n);listRefs.current[n]?.focus()}
    else if(e.key.toLowerCase()==='k'){e.preventDefault();const n=Math.max(selectedGroup-1,0);setSelectedGroup(n);listRefs.current[n]?.focus()}
    else if(['1','2'].includes(e.key))setSelectedProposal(proposals[Number(e.key)-1].id)
    else if(e.key==='Enter'||e.key.toLowerCase()==='a')resolve()
    else if(e.key.toLowerCase()==='c')resolve()
    else if(e.key.toLowerCase()==='x')setState('reject-all-confirm')
    else if(e.key.toLowerCase()==='n')noteRef.current?.focus()
    else if(e.key==='Escape')mobileDetail?setMobileDetail(false):setState('populated')}
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[selectedGroup,mobileDetail,state])
  return <div className={`app conflicts-app compact ${dark?'dark':''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="shell-header"><div className="brand-bar"/><div className="header-inner"><button className="icon-button menu-button" aria-label="Open navigation"><Icon name="menu" size={20}/></button><a className="product-link" href="/review"><Logo/><span>Semantic Ground Truth</span></a><nav className="desktop-nav" aria-label="Main navigation">{nav.map(([n,i])=><a key={n} className={n==='Steward'?'active':''} href={n==='Steward'?'/steward':`/${n.toLowerCase()}`}><Icon name={i}/><span>{n}</span></a>)}</nav><div className="header-actions"><button className="icon-button" aria-label="Notifications (2 unread)"><Icon name="bell" size={20}/><span className="bell-count">2</span></button><button className="icon-button" aria-label="Switch theme" onClick={()=>setDark(!dark)}><Icon name="moon" size={20}/></button><button className="account-trigger" aria-label="Account menu"><span className="avatar">PR</span></button></div></div></header>
    {state==='offline'&&<div className="offline-banner"><Icon name="cloud" size={20}/><span><strong>You're offline.</strong> Conflict resolution is paused until the connection is back.</span></div>}
    <main id="main-content" className="conflicts-main">
      <div className="conflicts-heading"><p className="eyebrow">STEWARD REVIEW</p><h1>Conflicts</h1><p>Resolve competing edits and reviewer disagreement.</p></div>
      <nav className="steward-subnav" aria-label="Steward sections"><a href="/steward">Overview</a><a href="/steward/feedback-queue">Feedback queue <b>12</b></a><a className="active" href="/steward/conflicts">Conflicts <b>3</b></a><a href="/steward/feedback-branches">Feedback branches <b>1</b></a></nav>
      {state==='forbidden'?<StateCard icon="lock" title="Steward access required" copy="Ask an admin to add you to semantic-ground-truth-stewards."/>:state==='empty'?<StateCard testId="steward-conflicts-empty-root" icon="users" title="No conflicts. Reviewers agree." copy="New competing edits will appear here for resolution."/>:state==='error'?<ConflictError retry={()=>setState('populated')}/>:state==='loading'?<Loading/>:
      <div className={`conflicts-workspace ${mobileDetail?'show-detail':''}`}>
        <aside className="conflict-list" aria-label="Conflict groups"><div className="list-head"><strong>Open conflicts</strong><span>3 assets</span></div>{conflicts.map((c,i)=><button key={c.id} ref={el=>{listRefs.current[i]=el}} className={i===selectedGroup?'selected':''} data-testid="steward-conflicts-list-item" data-asset-id={c.id} onClick={()=>{setSelectedGroup(i);setMobileDetail(true)}}><div><strong>{c.name}</strong><span className="field-badge">Description</span></div><span>{c.count}</span><time>{c.age}</time></button>)}</aside>
        <section className="conflict-detail"><button className="mobile-back" onClick={()=>setMobileDetail(false)}><Icon name="back"/>Back to conflicts</button><div className="detail-heading"><div><span className="field-badge">DESCRIPTION</span><h2>{conflicts[selectedGroup].name}</h2><p>Choose the clearest definition or keep the current value.</p></div><span className="vote-tally"><Icon name="check"/>8 approvals · <Icon name="close"/>2 rejections</span></div>
          {state==='stale'&&<div className="stale-alert"><Icon name="info"/><span>Another steward already resolved this.</span><button data-testid="steward-conflicts-stale-refresh" onClick={()=>setState('populated')}><Icon name="refresh"/>Refresh</button></div>}
          <article className="current-card" data-testid="steward-conflicts-current"><span>Current</span><p>Percentage of discharged patients who are readmitted to any acute care facility within 30 days of their index discharge.</p></article>
          <div className="diff-legend"><span><i className="insert"/>Inserted</span><span><i className="delete"/>Removed</span></div>
          <div className="proposal-group" role="radiogroup" aria-label="Proposed descriptions">{proposals.map((p,i)=><article className={`proposal-card ${selectedProposal===p.id?'selected':''}`} data-testid="steward-conflicts-proposal" data-vote-id={p.id} key={p.id} onClick={()=>setSelectedProposal(p.id)}><label><input type="radio" name="proposal" checked={selectedProposal===p.id} onChange={()=>setSelectedProposal(p.id)} data-testid="steward-conflicts-proposal-select"/><span className="proposal-avatar">{p.initials}</span><span><strong>{p.name}</strong><small>Proposal {i+1} · {p.time}</small></span></label><p className="word-diff">{p.content}</p></article>)}</div>
          <label className="resolution-note">Resolution note <span>Optional</span><textarea ref={noteRef} maxLength={4000} data-testid="steward-conflicts-note" placeholder="Add context for reviewers and future stewards"/><small>0 / 4000</small></label>
          <div className="resolution-bar"><button disabled={disabled} className="accept" data-testid="steward-conflicts-accept" onClick={resolve}>{state==='resolving'?<span className="spinner"/>:<Icon name="check"/>}Accept selected edit</button><button disabled={disabled} data-testid="steward-conflicts-keep" onClick={resolve}>Keep current</button><button disabled={disabled} className="reject-all" data-testid="steward-conflicts-reject-all" onClick={()=>setState('reject-all-confirm')}><Icon name="close"/>Reject all</button></div>
        </section>
      </div>}
      <aside className="state-switcher"><strong>Preview state</strong><div>{(['populated','loading','empty','resolving','resolved-toast','stale','reject-all-confirm','error','forbidden','offline'] as PageState[]).map(s=><button key={s} className={state===s?'active':''} onClick={()=>setState(s)}>{s}</button>)}</div></aside>
    </main>
    {state==='resolved-toast'&&<div className="conflict-toast" role="status"><Icon name="check"/><span>Conflict resolved. Ana Duarte and Sam Okafor were notified.</span><button aria-label="Close" onClick={()=>setState('populated')}>×</button></div>}
    {state==='reject-all-confirm'&&<Confirm close={()=>setState('populated')} confirm={resolve}/>}
    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.slice(0,4).map(([n,i])=><a key={n} className={n==='Steward'?'active':''} href={n==='Steward'?'/steward':`/${n.toLowerCase()}`}><Icon name={i} size={20}/><span>{n}</span></a>)}</nav>
  </div>
}
function Confirm({close,confirm}:{close:()=>void,confirm:()=>void}){return <><button className="modal-scrim" aria-label="Close dialog" onClick={close}/><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reject-title" aria-describedby="reject-copy"><span className="confirm-icon"><Icon name="danger" size={24}/></span><h2 id="reject-title">Reject all proposals?</h2><p id="reject-copy">Both edits will be closed and reviewers will be notified. The current description will stay unchanged.</p><div><button autoFocus onClick={close}>Cancel</button><button className="destructive" onClick={confirm}><Icon name="close"/>Reject all</button></div></section></>}
function StateCard({icon,title,copy,testId}:{icon:string,title:string,copy:string,testId?:string}){return <section className="conflicts-state" data-testid={testId}><span><Icon name={icon} size={36}/></span><h2>{title}</h2><p>{copy}</p></section>}
function ConflictError({retry}:{retry:()=>void}){return <section className="conflict-error"><Icon name="danger" size={24}/><div><strong>We couldn't load conflicts</strong><p>No resolutions were changed.</p></div><button onClick={retry}>Retry</button></section>}
function Loading(){return <div className="conflicts-loading"><aside>{Array.from({length:3}).map((_,i)=><i key={i}/>)}</aside><section>{Array.from({length:5}).map((_,i)=><i key={i}/>)}</section></div>}
