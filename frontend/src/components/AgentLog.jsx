import { useEffect, useRef } from 'react'

const AGENT_COLORS = {
  tracking_agent:     { bg: '#0d2d4a', accent: '#38bdf8', label: 'TRACKING' },
  prediction_agent:   { bg: '#1a1a3e', accent: '#a78bfa', label: 'PREDICTION' },
  optimization_agent: { bg: '#0d2e1a', accent: '#34d399', label: 'OPTIMIZATION' },
  negotiation_agent:  { bg: '#2d1a0d', accent: '#fb923c', label: 'NEGOTIATION' },
  governance_agent:   { bg: '#1a0d2d', accent: '#f472b6', label: 'GOVERNANCE' },
  system:             { bg: '#1a0d0d', accent: '#f87171', label: 'SYSTEM' },
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour12: false })
  } catch {
    return '--:--:--'
  }
}

function AgentBadge({ agent }) {
  const cfg = AGENT_COLORS[agent] || { accent: '#94a3b8', label: agent?.toUpperCase() }
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 8px',
      borderRadius: '3px',
      fontSize: '10px',
      fontWeight: 'bold',
      letterSpacing: '0.08em',
      color: cfg.accent,
      border: `1px solid ${cfg.accent}44`,
      background: `${cfg.accent}11`,
    }}>
      {cfg.label}
    </span>
  )
}

function LogEntry({ entry, index }) {
  const cfg = AGENT_COLORS[entry.agent] || {}

  return (
    <div style={{
      padding: '10px 14px',
      borderLeft: `3px solid ${cfg.accent || '#94a3b8'}`,
      background: cfg.bg || 'transparent',
      marginBottom: '6px',
      borderRadius: '0 4px 4px 0',
      animation: 'slideIn 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <AgentBadge agent={entry.agent} />
        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
          {formatTime(entry.timestamp)}
        </span>
      </div>
      <pre style={{
        margin: 0,
        fontSize: '12px',
        lineHeight: '1.6',
        color: '#cbd5e1',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'inherit',
      }}>
        {entry.message}
      </pre>
    </div>
  )
}

export default function AgentLog({ messages }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#070f1a',
      border: '1px solid #1e3a5f',
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid #1e3a5f',
        fontSize: '11px',
        letterSpacing: '0.1em',
        color: '#38bdf8',
        fontWeight: 'bold',
        background: '#040c16',
      }}>
        AGENT REASONING LOG
        <span style={{ float: 'right', color: '#64748b', fontWeight: 'normal' }}>
          {messages.length} entries
        </span>
      </div>

      {/* Log entries */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
        scrollbarWidth: 'thin',
        scrollbarColor: '#1e3a5f #040c16',
      }}>
        {messages.length === 0 ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            color: '#334155',
            fontSize: '12px',
          }}>
            Awaiting scenario trigger...
          </div>
        ) : (
          messages.map((msg, i) => (
            <LogEntry key={i} entry={msg} index={i} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
