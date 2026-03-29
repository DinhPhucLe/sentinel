import { useState, useRef, useEffect } from 'react'

const WELCOME = "I'm **Sentinel AI**, your orbital traffic assistant.\n\nAsk me about *satellites*, *collision risks*, or *orbital zones* — or try commands like __\"show me alerts\"__ or __\"hide critical conjunctions\"__."

// ── Markdown inline renderer ──────────────────────────────────────────
function renderInline(text, keyPrefix = '') {
  const parts = []
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|`(.+?)`/g
  let last = 0, match, i = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[1] !== undefined)
      parts.push(<strong key={keyPrefix + i} style={{ color: 'var(--text-heading)', fontWeight: 700 }}>{match[1]}</strong>)
    else if (match[2] !== undefined)
      parts.push(<em key={keyPrefix + i} style={{ color: 'var(--accent)', fontStyle: 'italic' }}>{match[2]}</em>)
    else if (match[3] !== undefined)
      parts.push(<u key={keyPrefix + i} style={{ textDecorationColor: 'var(--accent-dim)' }}>{match[3]}</u>)
    else if (match[4] !== undefined)
      parts.push(
        <code key={keyPrefix + i} style={{
          background: 'var(--bg-deep)', padding: '1px 5px',
          borderRadius: '3px', fontFamily: 'var(--font-mono)',
          fontSize: '10px', color: 'var(--accent)',
        }}>{match[4]}</code>
      )
    last = match.index + match[0].length
    i++
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let listItems = []
  let numberedItems = []
  let key = 0

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul key={key++} style={{ margin: '5px 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.55 }}>
              {renderInline(item, `ul${key}${idx}`)}
            </li>
          ))}
        </ul>
      )
      listItems = []
    }
    if (numberedItems.length) {
      elements.push(
        <ol key={key++} style={{ margin: '5px 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {numberedItems.map((item, idx) => (
            <li key={idx} style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.55 }}>
              {renderInline(item, `ol${key}${idx}`)}
            </li>
          ))}
        </ol>
      )
      numberedItems = []
    }
  }

  for (const line of lines) {
    if (!line.trim()) {
      flushList()
      elements.push(<div key={key++} style={{ height: '5px' }} />)
      continue
    }

    const h1 = line.match(/^#\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h3 = line.match(/^###\s+(.+)/)
    if (h3) {
      flushList()
      elements.push(<div key={key++} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '6px' }}>{renderInline(h3[1], `h3${key}`)}</div>)
      continue
    }
    if (h2) {
      flushList()
      elements.push(<div key={key++} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)', marginTop: '8px', marginBottom: '2px' }}>{renderInline(h2[1], `h2${key}`)}</div>)
      continue
    }
    if (h1) {
      flushList()
      elements.push(<div key={key++} style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'var(--font-display)', marginTop: '8px', marginBottom: '4px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>{renderInline(h1[1], `h1${key}`)}</div>)
      continue
    }

    const bullet = line.match(/^[-•*]\s+(.+)/)
    if (bullet) { listItems.push(bullet[1]); continue }

    const numbered = line.match(/^\d+\.\s+(.+)/)
    if (numbered) { numberedItems.push(numbered[1]); continue }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushList()
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '6px 0' }} />)
      continue
    }

    flushList()
    elements.push(
      <div key={key++} style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '1px' }}>
        {renderInline(line, `p${key}`)}
      </div>
    )
  }
  flushList()
  return elements
}

// ── Typing animation config ───────────────────────────────────────────
const TYPING_SPEED = 10  // chars per tick
const TYPING_INTERVAL = 18 // ms

// ── Component ─────────────────────────────────────────────────────────
export default function ChatBot({ satellites = [], events = [], status = 'MONITORING', view = 'mission', onAction, agentMessages = [] }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const [typingIndex, setTypingIndex] = useState(null)
  const [typingText, setTypingText] = useState('')
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
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: { satellites, events, status, view },
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
              <img
                src="/sentinel-logo.png"
                alt="Sentinel"
                style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(94,170,187,0.2)' }}
              />
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
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '7px' }}>
                {m.role === 'assistant' && (
                  <img src="/sentinel-logo.png" alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginBottom: '2px', border: '1px solid rgba(94,170,187,0.15)' }} />
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
                      <>
                        {renderMarkdown(displayContent(m, i))}
                        {i === typingIndex && (
                          <span style={{
                            display: 'inline-block', width: '2px', height: '13px',
                            background: 'var(--accent)', marginLeft: '2px',
                            animation: 'pulse 0.7s ease-in-out infinite',
                            verticalAlign: 'middle', borderRadius: '1px',
                          }} />
                        )}
                      </>
                    )
                  }
                </div>
              </div>
            ))}

            {/* Animated loading dots */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '7px' }}>
                <img src="/sentinel-logo.png" alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(94,170,187,0.15)' }} />
                <div style={{ padding: '11px 16px', borderRadius: '3px 14px 14px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', gap: '5px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: 'var(--accent-dim)',
                      animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
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
            display: 'flex', gap: '7px',
            background: 'var(--bg-deep)',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask about satellites, risks, orbits…"
              style={{
                flex: 1, background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '7px 10px', fontSize: '12px',
                color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
                outline: 'none', transition: 'border-color 0.15s',
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
            >SEND</button>
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
            : <img src="/sentinel-logo.png" alt="Sentinel AI" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' }} />
          }
        </button>
      </div>
    </div>
  )
}
