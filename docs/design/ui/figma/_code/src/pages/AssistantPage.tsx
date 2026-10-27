import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { BrandIcon, BrandIllustration, BrandLogo, BrandProductIcon } from '../components/BrandAssets'

type ChatState = 'empty' | 'populated' | 'streaming' | 'error' | 'no-agent' | 'offline'
type Message = { role: 'user' | 'assistant' | 'tool'; text: string }

const paths: Record<string, ReactNode> = {
  review: <path d="M3 4h1M3 8h1M3 12h1M7 4h6M7 8h6M7 12h6" />,
  ranking: <path d="M3 4h7M3 8h10M3 12h5" />,
  sparkle: <path d="m8 2 .8 3.2L12 6l-3.2.8L8 10l-.8-3.2L4 6l3.2-.8L8 2Zm4 8 .4 1.6L14 12l-1.6.4L12 14l-.4-1.6L10 12l1.6-.4L12 10Z" />,
  shield: <path d="M8 2.5 13 4v3.5c0 3-2 5-5 6-3-1-5-3-5-6V4l5-1.5Z" />,
  chart: <path d="M3 12V8M8 12V3M13 12V6" />,
  gear: <><circle cx="8" cy="8" r="2.5" /><path d="M8 2v2M8 12v2M2 8h2M12 8h2" /></>,
  bell: <path d="M4 11h8l-1-2V6a3 3 0 0 0-6 0v3l-1 2Zm3 2h2" />,
  moon: <path d="M12.5 10.5A5.5 5.5 0 0 1 5.5 3.5a5 5 0 1 0 7 7Z" />,
  menu: <path d="M2 4h12M2 8h12M2 12h12" />,
  send: <><path d="m2 3 12 5-12 5 2-5-2-5Z" /><path d="M4 8h7" /></>,
  plus: <path d="M8 3v10M3 8h10" />,
  danger: <><path d="M8 2 14 13H2L8 2Z" /><path d="M8 6v3M8 11h.01" /></>,
  chat: <><path d="M2 3h12v8H7l-3 2v-2H2V3Z" /><path d="M5 6h6M5 8h4" /></>,
  info: <><circle cx="8" cy="8" r="6" /><path d="M8 7v4M8 5h.01" /></>,
}
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return <BrandIcon name={name} size={size} fallback={paths[name]} />
}
function Logo() { return <BrandLogo /> }
function GenieIcon() { return <BrandProductIcon file="genie-icon-full-color-container.svg" label="Genie" className="genie-icon" /> }
const nav = [['Review', 'review'], ['Leaderboard', 'ranking'], ['Assistant', 'sparkle'], ['Steward', 'shield'], ['Executive', 'chart'], ['Admin', 'gear']]
const initialMessages: Message[] = [
  { role: 'user', text: 'Why is the confidence score for Readmission Rate (30-day) 71%?' },
  { role: 'tool', text: 'Looked up: Readmission Rate (30-day)' },
  { role: 'assistant', text: 'The 71% score reflects agreement across 11 reviewer votes. Eight reviewers approved the definition, two proposed edits, and one rejected it.' },
  { role: 'assistant', text: 'The score is in the medium band because reviewers agree on the intent, but two edits still need steward review. Resolving those edits could move the asset into the high-confidence band.' },
]
const starters = [
  'Explain the confidence score for Readmission Rate (30-day)',
  "Show me this week's leaderboard",
  "What's our coverage summary?",
]

export default function App() {
  const [dark, setDark] = useState(false)
  const [state, setState] = useState<ChatState>('populated')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const send = (text = input) => {
    const clean = text.trim()
    if (!clean || state === 'streaming' || state === 'offline') return
    setMessages(previous => [...previous, { role: 'user', text: clean }, { role: 'tool', text: 'Looked up: semantic assets' }])
    setInput('')
    setState('streaming')
    window.setTimeout(() => {
      setMessages(previous => [...previous, { role: 'assistant', text: 'I found the relevant semantic assets. Their confidence scores combine reviewer agreement, edit activity, and the number of completed votes.' }])
      setState('populated')
      inputRef.current?.focus()
    }, 900)
  }
  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }
  const chooseStarter = (prompt: string) => {
    setMessages([])
    setState('populated')
    send(prompt)
  }
  const shownMessages = state === 'empty' ? [] : messages

  return <div className={`app assistant-app ${dark ? 'dark' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="shell-header" data-testid="shell-header-root"><div className="brand-bar" /><div className="header-inner">
      <button className="icon-button menu-button" aria-label="Open navigation"><Icon name="menu" size={20} /></button>
      <a className="product-link" href="/review"><Logo /><span>Semantic Ground Truth</span></a>
      <nav className="desktop-nav" aria-label="Main navigation">{nav.map(([name, icon]) => <a key={name} className={name === 'Assistant' ? 'active' : ''} href={name === 'Steward' ? '/steward' : `/${name.toLowerCase()}`}><Icon name={icon} /><span>{name}</span></a>)}</nav>
      <div className="header-actions"><button className="icon-button" aria-label="Notifications (2 unread)"><Icon name="bell" size={20} /><span className="bell-count">2</span></button><button className="icon-button" aria-label="Switch theme" onClick={() => setDark(!dark)}><Icon name="moon" size={20} /></button><button className="account-trigger" aria-label="Account menu"><span className="avatar">PR</span></button></div>
    </div></header>

    <main id="main-content" className="assistant-main">
      <div className="assistant-heading">
        <div className="assistant-title"><GenieIcon /><div><p className="eyebrow">GENIE</p><h1>Assistant</h1></div></div>
        <p>Ask about any asset, its confidence score, campaigns or the leaderboard. Answers are read-only.</p>
      </div>

      {state === 'no-agent' ? <section className="no-agent"><span className="chat-primary-icon"><BrandIllustration name="chat" /></span><h2>The assistant isn't set up for this app yet.</h2><p>Ask an admin to connect an assistant before starting a conversation.</p></section> :
      <section className="chat-card" data-testid="assistant-chat-root">
        <div className="conversation" role="log" aria-live="polite" aria-label="Conversation">
          {state === 'empty' ? <div className="chat-empty">
            <div className="assistant-mark"><GenieIcon /></div>
            <h2>What would you like to know?</h2>
            <p>I can explain definitions, confidence, campaign progress and reviewer activity.</p>
            <div className="starter-prompts">{starters.map(prompt => <button key={prompt} data-testid="assistant-starter-prompt" onClick={() => chooseStarter(prompt)}>{prompt}<span>↗</span></button>)}</div>
          </div> : <>
            <div className="conversation-date"><span>Today</span></div>
            {shownMessages.map((message, index) => message.role === 'tool'
              ? <div className="tool-row" key={index} data-testid="assistant-chat-message" data-role="tool"><Icon name="sparkle" />{message.text}</div>
              : <div className={`message-row ${message.role}`} key={index} data-testid="assistant-chat-message" data-role={message.role}>
                  {message.role === 'assistant' && <span className="message-avatar"><GenieIcon /></span>}
                  <div className="message-bubble">{message.text}</div>
                  {message.role === 'user' && <span className="avatar">PR</span>}
                </div>
            )}
            {state === 'streaming' && <div className="message-row assistant" data-testid="assistant-chat-message" data-role="assistant"><span className="message-avatar"><GenieIcon /></span><div className="message-bubble typing" aria-label="Assistant is typing"><i /><i /><i /></div></div>}
            {state === 'error' && <div className="assistant-error" role="alert"><Icon name="danger" size={20} /><span>The assistant couldn't answer. Try again.</span><button data-testid="assistant-error-retry" onClick={() => setState('streaming')}>Try again</button></div>}
          </>}
        </div>
        <div className="composer">
          {state === 'offline' && <div className="composer-status"><Icon name="info" />You're offline. Reconnect to message the assistant.</div>}
          <div className="composer-box">
            <label className="skill-select"><span className="sr-only">Choose a skill</span><select aria-label="Choose a skill"><option>+ Skill</option><option>Semantic assets</option><option>Leaderboard</option><option>Campaigns</option></select></label>
            <textarea ref={inputRef} rows={1} value={input} disabled={state === 'streaming' || state === 'offline'} data-testid="assistant-composer-input" aria-label="Message the assistant" placeholder="Ask a question…" onChange={event => setInput(event.target.value)} onKeyDown={onComposerKeyDown} />
            <button className="send-button" disabled={!input.trim() || state === 'streaming' || state === 'offline'} data-testid="assistant-composer-send" aria-label="Send message" onClick={() => send()}>{state === 'streaming' ? <span className="spinner" /> : <Icon name="send" size={20} />}<span>Send</span></button>
          </div>
          <p>Answers may be incomplete. Verify important definitions with a steward.</p>
        </div>
      </section>}

      <aside className="state-switcher"><strong>Preview state</strong><div>{(['empty', 'populated', 'streaming', 'error', 'no-agent', 'offline'] as ChatState[]).map(value => <button key={value} className={state === value ? 'active' : ''} onClick={() => setState(value)}>{value}</button>)}</div></aside>
    </main>
    <nav className="bottom-nav" aria-label="Mobile navigation">{nav.slice(0, 4).map(([name, icon]) => <a key={name} className={name === 'Assistant' ? 'active' : ''} href={name === 'Steward' ? '/steward' : `/${name.toLowerCase()}`}><Icon name={icon} size={20} /><span>{name}</span></a>)}</nav>
  </div>
}
