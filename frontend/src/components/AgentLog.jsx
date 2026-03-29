import { useEffect, useRef, useState } from 'react'

const AGENT_META = {
  tracking_agent:     { label: 'TRACKING',     color: '#5eaabb', icon: '◎', step: 1 },
  prediction_agent:   { label: 'PREDICTION',   color: '#a78bfa', icon: '◈', step: 2 },
  optimization_agent: { label: 'OPTIMIZATION', color: '#fbbf24', icon: '◆', step: 3 },
  negotiation_agent:  { label: 'NEGOTIATION',  color: '#fb923c', icon: '◉', step: 4 },
  governance_agent:   { label: 'GOVERNANCE',   color: '#34d399', icon: '◇', step: 5 },
  system:             { label: 'SYSTEM',       color: '#f87171', icon: '!', step: 0 },
}

const AGENT_ORDER = ['tracking_agent','prediction_agent','optimization_agent','negotiation_agent','governance_agent']

function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour12: false }) }
  catch { return '--:--:--' }
}

function hexToRgb(hex) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`
}

// ── Typewriter hook ──────────────────────────────────────────────────

function useTypewriter(text, speed = 8, enabled = true) {
  const [displayed, setDisplayed] = useState(enabled ? '' : text)
  const [done, setDone] = useState(!enabled)

  useEffect(() => {
    if (!enabled || !text) { setDisplayed(text || ''); setDone(true); return }
    let i = 0
    setDisplayed('')
    setDone(false)
    const id = setInterval(() => {
      i += 1 + Math.floor(Math.random() * 2) // vary speed slightly
      if (i >= text.length) { setDisplayed(text); setDone(true); clearInterval(id) }
      else setDisplayed(text.slice(0, i))
    }, speed)
    return () => clearInterval(id)
  }, [text, speed, enabled])

  return [displayed, done]
}

// ── Thinking indicator ───────────────────────────────────────────────

function ThinkingIndicator({ agent, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 12px', margin: '0 0 4px',
      borderLeft: `2px solid ${color}`,
      borderRadius: '0 6px 6px 0',
      background: `rgba(${hexToRgb(color)},0.04)`,
      animation: 'slideIn 0.3s var(--ease-out)',
    }}>
      {/* Brain icon */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }}>
        <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/>
        <path d="M10 21h4M9 14h6"/>
      </svg>
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-display)', color, fontWeight: '600', letterSpacing: '0.1em' }}>
        {agent} REASONING
      </span>
      <div style={{ display: 'flex', gap: '3px', marginLeft: '4px' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: '3px', height: '3px', borderRadius: '50%', background: color,
            animation: `thinkDot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ── Structured text parser ───────────────────────────────────────────
// Converts raw agent text into structured JSX with bold, bullets, etc.

function StructuredText({ text, accentColor }) {
  if (!text) return null
  const lines = text.split('\n')

  return (
    <>
      {lines.map((line, i) => (
        <div key={i} style={{ minHeight: line.trim() === '' ? '6px' : undefined }}>
          <FormattedLine line={line} accent={accentColor} />
        </div>
      ))}
    </>
  )
}

function FormattedLine({ line, accent }) {
  const trimmed = line.trim()
  if (!trimmed) return null

  // ── Section headers (ALL CAPS, colon-ending, or ─ dividers)
  if (/^[A-Z][A-Z\s\-_:]{4,}$/.test(trimmed) || trimmed.includes('─')) {
    return (
      <div style={{
        color: accent, fontWeight: '700', fontSize: '10px',
        letterSpacing: '0.12em', margin: '6px 0 3px',
        fontFamily: 'var(--font-display)',
      }}>
        {trimmed.replace(/─/g, '')}
      </div>
    )
  }

  // ── Approved / Pass lines
  if (/✓|APPROVED|PASS/i.test(trimmed)) {
    return (
      <div style={{ color: '#34d399', fontWeight: '600', margin: '4px 0' }}>
        {trimmed}
      </div>
    )
  }

  // ── Rejected / Fail lines
  if (/✗|REJECTED|FAIL/i.test(trimmed)) {
    return (
      <div style={{ color: '#f87171', fontWeight: '600', margin: '4px 0' }}>
        {trimmed}
      </div>
    )
  }

  // ── Arrow lines (→ handoff / conclusion)
  if (trimmed.startsWith('→')) {
    return (
      <div style={{
        color: accent, fontStyle: 'italic', opacity: 0.75,
        margin: '6px 0 2px', fontSize: '10px',
      }}>
        {trimmed}
      </div>
    )
  }

  // ── Bullet point lines (- or • prefix)
  if (/^[-•]\s/.test(trimmed)) {
    return (
      <div style={{ display: 'flex', gap: '6px', margin: '2px 0', paddingLeft: '4px' }}>
        <span style={{ color: accent, flexShrink: 0, fontSize: '8px', marginTop: '3px' }}>●</span>
        <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <InlineFormatted text={trimmed.replace(/^[-•]\s/, '')} accent={accent} />
        </span>
      </div>
    )
  }

  // ── Key : Value lines
  const colonMatch = trimmed.match(/^([A-Za-z][\w\s/()]+?)\s*:\s*(.+)$/)
  if (colonMatch) {
    return (
      <div style={{ display: 'flex', gap: '6px', margin: '2px 0' }}>
        <span style={{
          color: 'var(--text-tertiary)', fontWeight: '600', fontSize: '10px',
          fontFamily: 'var(--font-display)', whiteSpace: 'nowrap', minWidth: '70px',
        }}>
          {colonMatch[1]}
        </span>
        <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
          <InlineFormatted text={colonMatch[2]} accent={accent} />
        </span>
      </div>
    )
  }

  // ── Default paragraph
  return (
    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '1px 0' }}>
      <InlineFormatted text={trimmed} accent={accent} />
    </div>
  )
}

// Inline formatting: bold **text**, numbers, percentages
function InlineFormatted({ text, accent }) {
  // Split on **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ color: 'var(--text-heading)', fontWeight: '700' }}>{part.slice(2, -2)}</strong>
        }
        // Highlight numbers with units (km, m/s, %, h)
        return <span key={i}>{part.replace(
          /(\d+\.?\d*\s*(?:km|m\/s|%|h\b))/g,
          (m) => m // keep as-is in text, the monospace font makes them stand out
        )}</span>
      })}
    </>
  )
}

// ── Log entry with typewriter ────────────────────────────────────────

function LogEntry({ entry, isLatest }) {
  const meta = AGENT_META[entry.agent] ?? { label: entry.agent?.toUpperCase(), color: '#475569', icon: '·' }
  const isReroute = entry.agent === 'system' && entry.message?.includes('REROUTING')
  const [displayed, done] = useTypewriter(entry.message, 6, isLatest)

  return (
    <div style={{
      marginBottom: '6px',
      borderLeft: `2px solid ${meta.color}`,
      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
      background: isReroute
        ? 'rgba(248,113,113,0.03)'
        : `rgba(${hexToRgb(meta.color)},0.02)`,
      animation: 'slideIn 0.3s var(--ease-out)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '6px 12px',
        background: `rgba(${hexToRgb(meta.color)},0.05)`,
      }}>
        <span style={{ fontSize: '11px', color: meta.color }}>{meta.icon}</span>
        <span style={{
          fontSize: '9px', fontWeight: '700', letterSpacing: '0.12em',
          fontFamily: 'var(--font-display)', color: meta.color,
          textTransform: 'uppercase',
        }}>
          {meta.label}
        </span>
        {/* Step badge */}
        {meta.step > 0 && (
          <span style={{
            fontSize: '8px', fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)', opacity: 0.6,
          }}>
            {meta.step}/5
          </span>
        )}
        <span style={{
          fontSize: '9px', color: 'var(--text-tertiary)',
          marginLeft: 'auto', fontFamily: 'var(--font-mono)',
        }}>
          {formatTime(entry.timestamp)}
        </span>
      </div>

      {/* Body — structured + typewriter */}
      <div style={{
        padding: '8px 12px',
        fontSize: '11px', lineHeight: 1.6,
        fontFamily: 'var(--font-mono)',
      }}>
        <StructuredText text={displayed} accentColor={meta.color} />
        {/* Blinking cursor while typing */}
        {!done && (
          <span style={{
            display: 'inline-block', width: '6px', height: '13px',
            background: meta.color, marginLeft: '1px',
            animation: 'cursorBlink 0.8s step-end infinite',
            verticalAlign: 'text-bottom', opacity: 0.8,
          }} />
        )}
      </div>
    </div>
  )
}

// ── Pipeline progress bar ────────────────────────────────────────────

function PipelineProgress({ doneAgents, activeAgent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {AGENT_ORDER.map((key, i) => {
        const meta = AGENT_META[key]
        const isDone = doneAgents.has(key)
        const isActive = activeAgent === key
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center' }}>
            <div title={meta.label} style={{
              width: isActive ? '20px' : '6px',
              height: '6px',
              borderRadius: '3px',
              background: isDone ? meta.color : isActive ? meta.color : 'var(--bg-surface-light)',
              transition: 'all 0.4s var(--ease-out)',
              boxShadow: (isDone || isActive) ? `0 0 6px ${meta.color}66` : 'none',
              animation: isActive ? 'pulse 1.2s ease-in-out infinite' : 'none',
            }} />
            {i < AGENT_ORDER.length - 1 && (
              <div style={{
                width: '8px', height: '1px',
                background: isDone ? `${AGENT_META[AGENT_ORDER[i+1]].color}44` : 'var(--border-subtle)',
                transition: 'background 0.4s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────

export default function AgentLog({ messages }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const doneAgents = new Set(messages.map(m => m.agent).filter(a => a !== 'system'))

  // Figure out which agent is "next" (active/thinking)
  const lastDoneIdx = AGENT_ORDER.reduce((max, key, i) => doneAgents.has(key) ? i : max, -1)
  const activeAgent = (messages.length > 0 && lastDoneIdx < AGENT_ORDER.length - 1)
    ? AGENT_ORDER[lastDoneIdx + 1]
    : null
  // Only show thinking if pipeline is in progress (has messages but not all 5 done)
  const showThinking = messages.length > 0 && doneAgents.size < 5 && activeAgent

  return (
    <div className="neo-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
      }}>
        <span style={{
          fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-secondary)',
          fontWeight: '600', fontFamily: 'var(--font-display)',
        }}>
          AGENT LOG
        </span>

        <PipelineProgress doneAgents={doneAgents} activeAgent={activeAgent} />

        <span style={{
          marginLeft: 'auto', color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)', fontSize: '9px',
        }}>
          {messages.length}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: '10px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span style={{
              fontSize: '11px', color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-body)', fontStyle: 'italic',
            }}>
              Select a conjunction and click SIMULATE
            </span>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <LogEntry key={i} entry={msg} isLatest={i === messages.length - 1} />
            ))}
            {/* Thinking indicator for next agent */}
            {showThinking && (
              <ThinkingIndicator
                agent={AGENT_META[activeAgent]?.label || 'AGENT'}
                color={AGENT_META[activeAgent]?.color || '#5eaabb'}
              />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes thinkDot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.3); }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
