import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const WELCOME = "I'm **Sentinel AI**, your orbital traffic assistant.\n\nAsk me about *satellites*, *collision risks*, or *orbital zones* — or try commands like **\"show me alerts\"** or **\"hide critical conjunctions\"**."

// ── Themed markdown components ────────────────────────────────────────
const MD_COMPONENTS = {
  p: ({ children }) => (
    <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.6 }}>{children}</p>
  ),
  strong: ({ children }) => (
    <strong style={{ color: 'var(--text-heading)', fontWeight: 700 }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>{children}</em>
  ),
  h1: ({ children }) => (
    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--font-display)', margin: '10px 0 4px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>{children}</div>
  ),
  h2: ({ children }) => (
    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)', margin: '8px 0 3px' }}>{children}</div>
  ),
  h3: ({ children }) => (
    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '6px 0 2px' }}>{children}</div>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: '4px 0 6px', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: '4px 0 6px', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.55 }}>{children}</li>
  ),
  code: ({ inline, children }) => inline
    ? <code style={{ background: 'var(--bg-deep)', padding: '1px 5px', borderRadius: '3px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)' }}>{children}</code>
    : <pre style={{ background: 'var(--bg-deep)', padding: '8px 10px', borderRadius: '6px', margin: '6px 0', overflowX: 'auto', border: '1px solid var(--border-subtle)' }}><code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-dim)' }}>{children}</code></pre>,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '8px 0' }} />,
  table: ({ children }) => (
    <div style={{ margin: '8px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(94,170,187,0.2)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: 'rgba(94,170,187,0.08)' }}>{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>{children}</tr>
  ),
  th: ({ children }) => (
    <th style={{ padding: '6px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.06em', fontSize: '10px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{ padding: '6px 10px', color: 'var(--text-primary)', verticalAlign: 'top', lineHeight: 1.45 }}>{children}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ margin: '6px 0', paddingLeft: '10px', borderLeft: '2px solid var(--accent-dim)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{children}</blockquote>
  ),
}

// Inline avatar — no external image required
function BotAvatar({ size }) {
  const cx = size / 2, cy = size / 2, r = size * 0.34
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #1a2640 0%, #0e1a2e 50%, #1a3050 100%)',
      border: '1px solid rgba(94,170,187,0.28)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="ba-g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d0e8f0" />
            <stop offset="100%" stopColor="#78b8cc" />
          </linearGradient>
        </defs>
        <ellipse cx={cx} cy={cy} rx={r * 1.1} ry={r * 0.52}
          fill="none" stroke="rgba(94,170,187,0.3)" strokeWidth="0.7"
          transform={`rotate(-20 ${cx} ${cy})`} />
        <text x={cx} y={cy + size * 0.14} textAnchor="middle"
          style={{ fontSize: `${size * 0.46}px`, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fill: 'url(#ba-g)' }}>
          S
        </text>
      </svg>
    </div>
  )
}

// ── Typing animation config ───────────────────────────────────────────
const TYPING_SPEED = 10  // chars per tick
const TYPING_INTERVAL = 18 // ms
const LOADING_PHASES = ['Thinking', 'Analyzing', 'Drafting response']

// ── Component ─────────────────────────────────────────────────────────
export default function ChatBot({ satellites = [], events = [], status = 'MONITORING', view = 'mission', onAction, agentMessages = [] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const [typingIndex, setTypingIndex] = useState(null)
  const [typingText, setTypingText] = useState('')
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0)
  const prevStatusRef = useRef(status)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Scroll + focus when open changes or messages arrive
  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      inputRef.current?.focus()
    }
  }, [messages, open])

  // ESC closes the chat
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Start typing animation on new assistant message
  useEffect(() => {
    const lastIdx = messages.length - 1
    const last = messages[lastIdx]
    if (last?.role === 'assistant' && lastIdx > 0) {
      setTypingIndex(lastIdx)
      setTypingText('')
    }
  }, [messages.length])

  // Advance typing
  useEffect(() => {
    if (typingIndex === null) return
    const full = messages[typingIndex]?.content || ''
    if (typingText.length >= full.length) { setTypingIndex(null); return }
    const id = setInterval(() => {
      setTypingText(prev => {
        const next = full.slice(0, prev.length + TYPING_SPEED)
        if (next.length >= full.length) clearInterval(id)
        return next
      })
    }, TYPING_INTERVAL)
    return () => clearInterval(id)
  }, [typingIndex, typingText])

  // Scroll during typing
  useEffect(() => {
    if (typingIndex !== null) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [typingText])

  // Badge nudge when pipeline finishes
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (!open && (status === 'AVOIDED' || status === 'ERROR') && prev !== status) {
      setUnread(u => u + 1)
    }
  }, [status, open])

  // Thinking/analyzing phase text while waiting on backend
  useEffect(() => {
    if (!loading) {
      setLoadingPhaseIndex(0)
      return
    }
    const id = setInterval(() => {
      setLoadingPhaseIndex(prev => (prev + 1) % LOADING_PHASES.length)
    }, 900)
    return () => clearInterval(id)
  }, [loading])

  // Ctrl+/ keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); setOpen(o => !o) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    if (inputRef.current) { inputRef.current.style.height = 'auto' }
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    const agentActivity = agentMessages?.length
      ? agentMessages.slice(-5).map(m => `[${m.agent}]: ${(m.message || '').slice(0, 200)}`).join('\n')
      : ''
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: { satellites, events, status, view, agentActivity },
          history: messages.slice(-10),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      if (!open) setUnread(u => u + 1)
      if (data.action && onAction) onAction(data.action)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '**Connection error** — is the backend running?' }])
    } finally {
      setLoading(false)
    }
  }

  const displayContent = (msg, idx) => idx === typingIndex ? typingText : msg.content

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>

      {/* ── Chat panel ──────────────────────────────────────────────── */}
      {open && (
        <div style={{
          width: '380px', height: '540px', marginBottom: '12px',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-elevated)',
          border: '1px solid rgba(94,170,187,0.2)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          animation: 'fadeInUp 0.2s var(--ease-out)',
        }}>

          {/* Header */}
          <div style={{
            padding: '10px 14px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(135deg, var(--bg-deep) 0%, #0a1520 100%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BotAvatar size={34} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--font-display)', letterSpacing: '0.14em' }}>
                  SENTINEL AI
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', animation: 'dotPulse 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>ORBITAL ASSISTANT · ONLINE</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setMessages([{ role: 'assistant', content: WELCOME }])}
                title="Clear chat"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '3px', lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '18px', lineHeight: 1, padding: '2px 4px' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
              >×</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '7px' }}>
                {m.role === 'assistant' && (
                  <BotAvatar size={24} />
                )}
                <div style={{
                  maxWidth: '82%',
                  padding: m.role === 'user' ? '8px 12px' : '10px 13px',
                  borderRadius: m.role === 'user' ? '14px 14px 3px 14px' : '3px 14px 14px 14px',
                  background: m.role === 'user' ? 'rgba(94,170,187,0.12)' : 'var(--bg-surface)',
                  border: '1px solid ' + (m.role === 'user' ? 'rgba(94,170,187,0.22)' : 'var(--border-subtle)'),
                }}>
                  {m.role === 'user'
                    ? <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.55 }}>{m.content}</div>
                    : (
                      <div style={{ minWidth: 0 }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                          {displayContent(m, i)}
                        </ReactMarkdown>
                        {i === typingIndex && (
                          <span style={{
                            display: 'inline-block', width: '2px', height: '13px',
                            background: 'var(--accent)', marginLeft: '2px',
                            animation: 'pulse 0.7s ease-in-out infinite',
                            verticalAlign: 'middle', borderRadius: '1px',
                          }} />
                        )}
                      </div>
                    )
                  }
                </div>
              </div>
            ))}

            {/* Animated loading indicator */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '7px' }}>
                <BotAvatar size={24} />
                <div style={{ padding: '10px 13px', borderRadius: '3px 14px 14px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', minWidth: '180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {LOADING_PHASES[loadingPhaseIndex]}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>AI</span>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '8px' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: 'var(--accent-dim)',
                        animation: `dotPulse 1.2s ease-in-out ${i * 0.18}s infinite`,
                      }} />
                    ))}
                  </div>
                  <div style={{ height: '3px', borderRadius: '999px', overflow: 'hidden', background: 'rgba(94,170,187,0.08)' }}>
                    <div style={{
                      width: '42%',
                      height: '100%',
                      borderRadius: '999px',
                      background: 'linear-gradient(90deg, rgba(94,170,187,0.2) 0%, rgba(94,170,187,0.75) 50%, rgba(94,170,187,0.2) 100%)',
                      animation: 'slideIn 0.9s var(--ease-out) infinite alternate',
                    }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested prompts */}
          {messages.length === 1 && (
            <div style={{ padding: '0 12px 10px', display: 'flex', flexWrap: 'wrap', gap: '6px', flexShrink: 0 }}>
              {[
                'Any collision warnings?',
                'What is Kessler Syndrome?',
                'Show me alerts',
                'Which satellite has most fuel?',
              ].map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus() }}
                  style={{
                    fontSize: '10px', padding: '4px 11px', borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                >{s}</button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{
            padding: '8px 10px', flexShrink: 0,
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex', gap: '7px', minWidth: 0,
            background: 'var(--bg-deep)',
          }}>
            <textarea
              ref={node => {
                inputRef.current = node
                // Recalculate height on mount (handles reopen with leftover text)
                if (node) {
                  node.style.height = 'auto'
                  node.style.height = Math.min(node.scrollHeight, 120) + 'px'
                }
              }}
              value={input}
              rows={1}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask about satellites, risks, orbits…"
              style={{
                flex: 1, minWidth: 0, background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '7px 10px', fontSize: '12px',
                color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                outline: 'none', transition: 'border-color 0.15s',
                resize: 'none', overflowY: 'auto', overflowX: 'hidden',
                wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                lineHeight: '1.5', minHeight: '32px', maxHeight: '120px',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-dim)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                background: loading || !input.trim() ? 'var(--bg-surface)' : 'var(--accent-dim)',
                border: '1px solid ' + (loading || !input.trim() ? 'var(--border-subtle)' : 'var(--accent-dim)'),
                color: loading || !input.trim() ? 'var(--text-tertiary)' : 'white',
                fontSize: '11px', fontWeight: 600, cursor: loading || !input.trim() ? 'default' : 'pointer',
                fontFamily: 'var(--font-display)', letterSpacing: '0.06em', transition: 'all 0.15s',
              }}
            >{loading ? 'WAIT' : 'SEND'}</button>
          </div>
        </div>
      )}

      {/* ── Floating bubble ─────────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        {unread > 0 && !open && (
          <div style={{
            position: 'absolute', top: '-4px', right: '-4px', zIndex: 1,
            width: '18px', height: '18px', borderRadius: '50%',
            background: 'var(--status-bad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 700, color: 'white',
            fontFamily: 'var(--font-mono)', border: '2px solid var(--bg-deep)',
          }}>{unread}</div>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          title="Sentinel AI Assistant (Ctrl+/)"
          style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'transparent', border: 'none',
            padding: 0, overflow: 'hidden',
            cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            transition: 'transform 0.2s var(--ease-out), box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 32px rgba(94,170,187,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.5)' }}
        >
          {open
            ? (
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid rgba(94,170,187,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-heading)" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </div>
            )
            : <BotAvatar size={52} />
          }
        </button>
      </div>
    </div>
  )
}
