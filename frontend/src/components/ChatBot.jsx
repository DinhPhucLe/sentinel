import { useState, useRef, useEffect } from 'react'

const WELCOME = "I'm Sentinel AI. Ask me about satellites, collision risks, orbital zones, or say things like \"show me alerts\" or \"what is Kessler Syndrome?\""

export default function ChatBot({ satellites = [], events = [], status = 'MONITORING', view = 'mission', onAction }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [messages, open])

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
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      if (data.action && onAction) onAction(data.action)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error — is the backend running?' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>

      {/* ── Expanded panel ────────────────────────────────────────── */}
      {open && (
        <div style={{
          width: '360px', height: '500px', marginBottom: '12px',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-elevated)',
          border: '1px solid rgba(94,170,187,0.18)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding: '10px 14px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-deep)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'dotPulse 2s ease-in-out infinite' }} />
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-heading)', fontFamily: 'var(--font-display)', letterSpacing: '0.12em' }}>SENTINEL AI</span>
              <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>ASSISTANT</span>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-tertiary)', fontSize: '18px', lineHeight: 1, padding: '2px 4px',
            }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%',
                  padding: '8px 11px',
                  borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                  background: m.role === 'user' ? 'rgba(94,170,187,0.12)' : 'var(--bg-surface)',
                  border: '1px solid ' + (m.role === 'user' ? 'rgba(94,170,187,0.25)' : 'var(--border-subtle)'),
                  fontSize: '12px', lineHeight: '1.55',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '8px 14px', borderRadius: '12px 12px 12px 3px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                }}>
                  analyzing...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested prompts — shown only when no user messages yet */}
          {messages.length === 1 && (
            <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: '6px', flexShrink: 0 }}>
              {[
                'Any collision warnings?',
                'What is Kessler Syndrome?',
                'Show me alerts',
                'Which satellite has most fuel?',
              ].map(s => (
                <button key={s} onClick={() => { setInput(s) }} style={{
                  fontSize: '10px', padding: '4px 10px', borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'border-color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-dim)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
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
                flex: 1,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '7px 10px',
                fontSize: '12px', color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)', outline: 'none',
                transition: 'border-color 0.15s',
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
                fontSize: '11px', fontWeight: '600', cursor: loading || !input.trim() ? 'default' : 'pointer',
                fontFamily: 'var(--font-display)', letterSpacing: '0.06em',
                transition: 'all 0.15s',
              }}
            >
              SEND
            </button>
          </div>
        </div>
      )}

      {/* ── Floating bubble ────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Sentinel AI Assistant"
        style={{
          width: '52px', height: '52px', borderRadius: '50%',
          background: open ? 'var(--bg-surface)' : 'var(--accent-dim)',
          border: '1px solid ' + (open ? 'rgba(94,170,187,0.3)' : 'var(--accent-dim)'),
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          transition: 'all 0.2s var(--ease-out)',
        }}
      >
        {open
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-heading)" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        }
      </button>
    </div>
  )
}
