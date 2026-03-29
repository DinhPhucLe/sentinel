import { useEffect, useRef } from 'react'

const AGENT_META = {
  tracking_agent:     { label: 'TRACKING',     color: '#5eaabb', icon: '◎' },
  prediction_agent:   { label: 'PREDICTION',   color: '#a78bfa', icon: '◈' },
  optimization_agent: { label: 'OPTIMIZATION', color: '#fbbf24', icon: '◆' },
  negotiation_agent:  { label: 'NEGOTIATION',  color: '#fb923c', icon: '◉' },
  governance_agent:   { label: 'GOVERNANCE',   color: '#34d399', icon: '◇' },
  system:             { label: 'SYSTEM',       color: '#f87171', icon: '!' },
}

function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour12: false }) }
  catch { return '--:--:--' }
}

function LogEntry({ entry }) {
  const meta = AGENT_META[entry.agent] ?? { label: entry.agent?.toUpperCase(), color: '#475569', icon: '·' }
  const isReroute = entry.agent === 'system' && entry.message?.includes('REROUTING')

  return (
    <div style={{
      marginBottom: '4px',
      borderLeft: `2px solid ${meta.color}`,
      borderRadius: '0 6px 6px 0',
      background: isReroute
        ? `rgba(248,113,113,0.04)`
        : `rgba(${hexToRgb(meta.color)},0.03)`,
      animation: 'slideIn 0.3s var(--ease-out)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '5px 10px',
        borderBottom: `1px solid rgba(${hexToRgb(meta.color)},0.1)`,
        background: `rgba(${hexToRgb(meta.color)},0.05)`,
      }}>
        <span style={{ fontSize: '10px', color: meta.color, fontWeight: '700', letterSpacing: '0.01em' }}>
          {meta.icon}
        </span>
        <span style={{
          fontSize: '9px', fontWeight: '700', letterSpacing: '0.12em',
          fontFamily: 'var(--font-display)', color: meta.color,
        }}>
          {meta.label}
        </span>
        <span style={{
          fontSize: '9px', color: 'var(--text-tertiary)',
          marginLeft: 'auto', fontFamily: 'var(--font-mono)',
        }}>
          {formatTime(entry.timestamp)}
        </span>
      </div>

      {/* Body */}
      <pre style={{
        margin: 0, padding: '7px 10px',
        fontSize: '10.5px', lineHeight: '1.65',
        color: colorizeText(entry.message, meta.color),
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: 'var(--font-mono)',
      }}>
        <ColorizedText text={entry.message} accentColor={meta.color} />
      </pre>
    </div>
  )
}

// Colorize specific patterns in the message text
function ColorizedText({ text, accentColor }) {
  if (!text) return null

  // Split on lines and apply inline color to key patterns
  const lines = text.split('\n')

  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          <ColorizedLine line={line} accent={accentColor} />
          {i < lines.length - 1 && '\n'}
        </span>
      ))}
    </>
  )
}

function ColorizedLine({ line, accent }) {
  // Headers (all caps lines or lines ending with ─)
  if (/^[A-Z][A-Z\s\-_:]{4,}$/.test(line.trim()) || line.includes('─')) {
    return <span style={{ color: accent, opacity: 0.85 }}>{line}</span>
  }
  // ✓ PASS lines
  if (line.includes('✓ PASS') || line.includes('✓ APPROVED') || line.includes('APPROVED')) {
    return <span style={{ color: '#34d399' }}>{line}</span>
  }
  // ✗ FAIL / REJECTED lines
  if (line.includes('✗ FAIL') || line.includes('✗ REJECTED') || line.includes('REJECTED')) {
    return <span style={{ color: '#f87171' }}>{line}</span>
  }
  // → arrow lines (handoff/conclusion)
  if (line.trimStart().startsWith('→')) {
    return <span style={{ color: accent, opacity: 0.7 }}>{line}</span>
  }
  // Key labels (WORD : value format)
  if (/^\s+[A-Z][A-Za-z\s]+\s*:/.test(line)) {
    const colonIdx = line.indexOf(':')
    return (
      <span>
        <span style={{ color: 'var(--text-tertiary)' }}>{line.slice(0, colonIdx + 1)}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{line.slice(colonIdx + 1)}</span>
      </span>
    )
  }
  // Default
  return <span style={{ color: 'var(--text-secondary)' }}>{line}</span>
}

// Stub — used only for background alpha
function colorizeText() { return 'inherit' }

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// ── Main component ────────────────────────────────────────────────────

export default function AgentLog({ messages }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Determine which agents have responded (for progress indicator)
  const doneAgents = new Set(messages.map(m => m.agent).filter(a => a !== 'system'))

  return (
    <div className="neo-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '7px 14px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
      }}>
        <span style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-secondary)', fontWeight: '600', fontFamily: 'var(--font-display)' }}>
          AGENT LOG
        </span>

        {/* Pipeline progress dots */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
          {Object.entries(AGENT_META).filter(([k]) => k !== 'system').map(([key, meta]) => (
            <div key={key} title={meta.label} style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: doneAgents.has(key) ? meta.color : 'var(--bg-surface-light)',
              transition: 'background 0.4s',
              boxShadow: doneAgents.has(key) ? `0 0 6px ${meta.color}66` : 'none',
            }} />
          ))}
        </div>

        <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
          {messages.length}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {messages.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)',
            fontSize: '11px', fontFamily: 'var(--font-body)',
            animation: 'pulse 3s ease-in-out infinite',
          }}>
            Select a conjunction and click SIMULATE
          </div>
        ) : (
          messages.map((msg, i) => <LogEntry key={i} entry={msg} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
