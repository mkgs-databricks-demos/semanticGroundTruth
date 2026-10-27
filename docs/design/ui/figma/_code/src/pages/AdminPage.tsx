import { useState, type ReactNode } from 'react'
import { BrandIcon, BrandLogo } from '../components/BrandAssets'

type PageState='populated'|'loading'|'empty-group'|'saving'|'saved'|'validation-error'|'last-admin-conflict'|'error'|'forbidden'|'offline'
type Confirm='remove'|'recompute'|'freshness'|null
const paths:Record<string,ReactNode>={
  review:<path d="M3 4h1M3 8h1M3 12h1M7 4h6M7 8h6M7 12h6"/>,ranking:<path d="M3 4h7M3 8h10M3 12h5"/>,sparkle:<path d="m8 2 .8 3.2L12 6l-3.2.8L8 10l-.8-3.2L4 6l3.2-.8L8 2Z"/>,shield:<path d="M8 2.5 13 4v3.5c0 3-2 5-5 6-3-1-5-3-5-6V4l5-1.5Z"/>,chart:<path d="M3 12V8M8 12V3M13 12V6"/>,gear:<><circle cx="8" cy="8" r="2.5"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2"/></>,bell:<path d="M4 11h8l-1-2V6a3 3 0 0 0-6 0v3l-1 2Zm3 2h2"/>,moon:<path d="M12.5 10.5A5.5 5.5 0 0 1 5.5 3.5a5 5 0 1 0 7 7Z"/>,menu:<path d="M2 4h12M2 8h12M2 12h12"/>,
  trash:<><path d="M3 4h10M6 4V2h4v2M5 6v7M8 6v7M11 6v7M4 4l1 10h6l1-10"/></>,plus:<path d="M8 3v10M3 8h10"/>,save:<path d="M3 2h8l2 2v10H3V2Zm2 0v4h5V2M5 10h6v4H5v-4Z"/>,danger:<><path d="M8 2 14 13H2L8 2Z"/><path d="M8 6v3M8 11h.01"/></>,check:<path d="m3 8 3 3 7-7"/>,lock:<><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></>,users:<><circle cx="6" cy="5" r="2.5"/><path d="M2 13c.4-2.4 1.7-3.5 4-3.5s3.6 1.1 4 3.5M10 4.2c2.1-.2 3.2.8 3.2 2.3S12.3 9 10.8 9"/></>,refresh:<><path d="M13 5V2l-1 1A6 6 0 1 0 13 10"/><path d="M13 2h-3"/></>
}
function Icon({name,size=16}:{name:string,size?:number}){return <BrandIcon name={name} size={size} fallback={paths[name]} />}
function Logo(){return <BrandLogo/>}
const nav=[['Review','review'],['Leaderboard','ranking'],['Assistant','sparkle'],['Steward','shield'],['Executive','chart'],['Admin','gear']]
const groups=[
  {name:'semantic-ground-truth-admins',role:'admin',members:[['priya.raman@databricks.com','system','Oct 02, 2024'],['spn://semantic-ground-truth-deploy','Priya Raman','Oct 18, 2024']]},
  {name:'semantic-ground-truth-stewards',role:'steward',members:[['mateo.silva@databricks.com','Priya Raman','Oct 04, 2024'],['ada.okafor@databricks.com','Priya Raman','Oct 04, 2024']]},
  {name:'semantic-ground-truth-users',role:'reviewer',members:[['jules.martin@databricks.com','Mateo Silva','Oct 08, 2024'],['emiko.sato@databricks.com','Mateo Silva','Oct 09, 2024']]},
]
const scoring=[
  ['Wilson z','1.96','','Controls confidence interval precision.'],
  ['Industry prior','0.7','','Expected approval rate before votes arrive.'],
  ['Prior weight','5','votes','Strength of the industry prior.'],
  ['Prior decay threshold','20','votes','Votes needed before the prior fully decays.'],
  ['Certification threshold','0.8','','Minimum confidence required for certification.'],
  ['Minimum votes for certification','10','votes','Required reviewer votes before certification.'],
  ['Staleness days','90','days','When an asset is marked stale.'],
  ['Freshness interval days','30','days','How often freshness is evaluated.'],
]
export default function App(){
  const [dark,setDark]=useState(false),[state,setState]=useState<PageState>('populated'),[confirm,setConfirm]=useState<Confirm>(null),[cooldown,setCooldown]=useState('24'),[added,setAdded]=useState<Record<string,string>>({})
  const disabled=state==='offline'||state==='saving'
  const save=()=>{if(Number(cooldown)>720||Number(cooldown)<0){setState('validation-error');return}setState('saving');setTimeout(()=>setState('saved'),650)}
  return <div className={`app admin-app ${dark?'dark':''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="shell-header"><div className="brand-bar"/><div className="header-inner"><button className="icon-button menu-button" aria-label="Open navigation"><Icon name="menu" size={20}/></button><a className="product-link" href="/review"><Logo/><span>Semantic Ground Truth</span></a><nav className="desktop-nav" aria-label="Main navigation">{nav.map(([n,i])=><a key={n} className={n==='Admin'?'active':''} href={n==='Steward'?'/steward':`/${n.toLowerCase()}`}><Icon name={i}/><span>{n}</span></a>)}</nav><div className="header-actions"><button className="icon-button" aria-label="Notifications (2 unread)"><Icon name="bell" size={20}/><span className="bell-count">2</span></button><button className="icon-button" aria-label="Switch theme" onClick={()=>setDark(!dark)}><Icon name="moon" size={20}/></button><button className="account-trigger" aria-label="Account menu"><span className="avatar">PR</span></button></div></div></header>
    {state==='offline'&&<div className="offline-banner"><Icon name="danger"/>You're offline. Admin settings are read-only until the connection is back.</div>}
    <main id="main-content" className="admin-main">
      <div className="admin-heading"><p className="eyebrow">SYSTEM CONFIGURATION</p><h1>Admin</h1><p>Manage access, scoring and maintenance for Semantic Ground Truth.</p></div>
      {state==='forbidden'?<Forbidden/>:state==='loading'?<Loading/>:state==='error'?<AdminError retry={()=>setState('populated')}/>:<>
        <Section title="Members" description="Manage group-based access and roles." save={()=>setState('saved')} disabled={disabled}>
          {state==='last-admin-conflict'&&<Alert>You can't remove the last admin.</Alert>}
          <div className="member-groups">{groups.map((group,index)=><section className="member-group" data-testid="admin-members-group" data-group={group.name} key={group.name}>
            <div className="group-title"><div><code>{group.name}</code><span className={`role role-${group.role}`}>{group.role}</span></div><span>{state==='empty-group'&&index===1?0:group.members.length} members</span></div>
            {state==='empty-group'&&index===1?<div className="empty-members"><Icon name="users"/><span>No members. Add an email or service principal id.</span></div>:<div className="member-table">{group.members.map((member,i)=><div className="member-row" key={member[0]}><code>{member[0]}</code><span>Added by {member[1]}</span><span>{member[2]}</span><button data-testid="admin-members-remove" aria-label={`Remove ${member[0]}`} onClick={()=>{if(group.role==='admin'&&i===0)setState('last-admin-conflict');else setConfirm('remove')}}><Icon name="trash"/></button></div>)}</div>}
            <div className="add-member"><label><span className="sr-only">Add member to {group.name}</span><input data-testid="admin-members-add-input" value={added[group.name]||''} onChange={e=>setAdded({...added,[group.name]:e.target.value})} placeholder="Email or service principal id"/></label><button disabled={disabled||!added[group.name]} data-testid="admin-members-add-submit"><Icon name="plus"/>Add member</button></div>
          </section>)}</div>
        </Section>
        <section className="admin-card"><div className="admin-card-head"><div><h2>Scoring</h2><p>Configure confidence, certification and review timing.</p></div><button disabled={disabled} data-testid="admin-scoring-save" onClick={save}>{state==='saving'?<span className="spinner"/>:<Icon name="save"/>}{state==='saving'?'Saving':'Save scoring'}</button></div>
          <div className="scoring-grid">{scoring.map(([label,value,unit,help])=><label key={label}>{label}<div className="number-field"><input type="number" defaultValue={value}/>{unit&&<span>{unit}</span>}</div><small>{help}</small></label>)}
            <label>Skip cooldown (hours)<div className={`number-field ${state==='validation-error'?'invalid':''}`}><input type="number" min="0" max="720" value={state==='validation-error'?'900':cooldown} onChange={e=>{setCooldown(e.target.value);setState('populated')}} data-testid="admin-scoring-skip-cooldown"/><span>hours</span></div><small>How long a skipped card stays hidden from that reviewer</small>{state==='validation-error'&&<em>Enter 0 to 720 hours</em>}</label>
          </div>
        </section>
        <Section title="Role lists" description="Legacy access lists used by older integrations." save={()=>setState('saved')} disabled={disabled} saveLabel="Save role lists">
          <div className="legacy-note"><Icon name="lock"/>Kept for compatibility. Manage access in Members.</div>
          <div className="legacy-roles"><div><strong>Admins</strong><span>priya.raman@databricks.com</span></div><div><strong>Stewards</strong><span>mateo.silva@databricks.com</span><span>ada.okafor@databricks.com</span></div><div><strong>Reviewers</strong><span>jules.martin@databricks.com</span><span>emiko.sato@databricks.com</span></div></div>
        </Section>
        <Section title="Maintenance" description="Run targeted administrative operations." save={()=>setState('saved')} disabled={disabled} saveLabel="Save maintenance">
          <div className="maintenance"><div><label>Recompute confidence for an asset<input placeholder="Asset id"/></label><button disabled={disabled} className="danger-outline" data-testid="admin-maintenance-recompute" onClick={()=>setConfirm('recompute')}><Icon name="refresh"/>Recompute confidence</button></div><div><div><strong>Freshness check</strong><p>Evaluate every registered asset against its freshness interval.</p></div><button disabled={disabled} className="danger-outline" data-testid="admin-maintenance-freshness" onClick={()=>setConfirm('freshness')}><Icon name="refresh"/>Run freshness check now</button></div></div>
        </Section>
      </>}
      <aside className="state-switcher"><strong>Preview state</strong><div>{(['populated','loading','empty-group','saving','saved','validation-error','last-admin-conflict','error','forbidden','offline'] as PageState[]).map(s=><button key={s} className={state===s?'active':''} onClick={()=>setState(s)}>{s}</button>)}</div></aside>
    </main>
    {state==='saved'&&<div className="admin-toast" role="status"><Icon name="check"/><span><strong>Changes saved</strong>Your admin settings are up to date.</span><button aria-label="Close" onClick={()=>setState('populated')}>×</button></div>}
    {confirm&&<ConfirmDialog kind={confirm} close={()=>setConfirm(null)}/>}
    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.slice(0,4).map(([n,i])=><a key={n} href={n==='Steward'?'/steward':`/${n.toLowerCase()}`}><Icon name={i} size={20}/><span>{n}</span></a>)}</nav>
  </div>
}
function Section({title,description,children,save,disabled,saveLabel='Save members'}:{title:string,description:string,children:ReactNode,save:()=>void,disabled:boolean,saveLabel?:string}){return <section className="admin-card"><div className="admin-card-head"><div><h2>{title}</h2><p>{description}</p></div><button disabled={disabled} onClick={save}><Icon name="save"/>{saveLabel}</button></div>{children}</section>}
function Alert({children}:{children:ReactNode}){return <div className="admin-alert" role="alert"><Icon name="danger"/><span>{children}</span></div>}
function ConfirmDialog({kind,close}:{kind:Exclude<Confirm,null>,close:()=>void}){const copy=kind==='remove'?['Remove member?','They will lose access provided by this group.','Remove member']:kind==='recompute'?['Recompute confidence?','This recalculates the score using current votes and scoring settings.','Recompute']:['Run freshness check?','This may mark assets stale and notify their owners.','Run check'];return <><button className="modal-scrim" aria-label="Close dialog" onClick={close}/><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><span className="confirm-icon"><Icon name="danger" size={24}/></span><h2 id="confirm-title">{copy[0]}</h2><p id="confirm-description">{copy[1]}</p><div><button autoFocus onClick={close}>Cancel</button><button className="destructive" onClick={close}>{copy[2]}</button></div></section></>}
function Forbidden(){return <section className="admin-state" data-testid="admin-forbidden-root"><span><Icon name="lock" size={36}/></span><h2>Admin access required</h2><p>Ask an existing admin to add you to semantic-ground-truth-admins.</p></section>}
function Loading(){return <div className="admin-loading">{Array.from({length:4}).map((_,i)=><section key={i}><i/><i/><i/><i/></section>)}</div>}
function AdminError({retry}:{retry:()=>void}){return <section className="admin-error"><Icon name="danger" size={24}/><div><strong>We couldn't load admin settings</strong><p>No changes were made. Try loading this page again.</p></div><button onClick={retry}>Retry</button></section>}
