import { useEffect, useRef } from 'react'

const AGENT_STYLES = {
  tracking_agent:     { label: 'TRACKING' },
  prediction_agent:   { label: 'PREDICTION' },
  optimization_agent: { label: 'OPTIMIZATION' },
  negotiation_agent:  { label: 'NEGOTIATION' },
  governance_agent:   { label: 'GOVERNANCE' },
  system:             { label: 'SYSTEM' },
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour12: false })
  } catch {
    return '--:--:--'
  }
}

function AgentBadge({ agent }) {
  const cfg = AGENT_STYLES[agent] || { label: agent?.toUpperCase() }
  const isSystem = agent === 'system'

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 'var(--radius-full)',
      fontSize: '9px',
      fontWeight: '600',
      letterSpacing: '0.1em',
      fontFamily: 'var(--font-display)',
      color: isSystem ? 'var(--status-danger)' : 'var(--accent)',
      border: `1px solid ${isSystem ? 'rgba(224,64,80,0.2)' : 'var(--border-accent)'}`,
      background: isSystem ? 'rgba(224,64,80,0.06)' : 'var(--accent-subtle)',
    }}>
      {cfg.label}
    </span>
  )
}

function LogEntry({ entry }) {
  const isSystem = entry.agent === 'system'

  return (
    <div style={{
      padding: '10px 14px',
      borderLeft: `2px solid ${isSystem ? 'var(--status-danger)' : 'var(--border-accent)'}`,
      background: isSystem ? 'rgba(224,64,80,0.03)' : 'var(--accent-subtle)',
      marginBottom: '6px',
      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
      animation: 'slideIn 0.3s var(--ease-out)',
      transition: 'background 0.2s',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '6px',
      }}>
        <AgentBadge agent={entry.agent} />
        <span style={{
          fontSize: '10px',
          color: 'var(--text-tertiary)',
          marginLeft: 'auto',
          fontFamily: 'var(--font-mono)',
        }}>
          {formatTime(entry.timestamp)}
        </span>
      </div>
      <pre style={{
        margin: 0,
        fontSize: '11.5px',
        lineHeight: '1.65',
        color: 'var(--text-secondary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'var(--font-mono)',
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
    <div className="neo-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: '11px',
        letterSpacing: '0.14em',
        color: 'var(--accent)',
        fontWeight: '600',
        fontFamily: 'var(--font-display)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        AGENT REASONING LOG
        <span style={{
          marginLeft: 'auto',
          color: 'var(--text-tertiary)',
          fontWeight: '400',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
        }}>
          {messages.length} entries
        </span>
      </div>

      {/* Entries */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-sm)',
      }}>
        {messages.length === 0 ? (
          <div style={{
            padding: '32px',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: '12px',
            fontFamily: 'var(--font-body)',
            animation: 'pulse 3s ease-in-out infinite',
          }}>
            Awaiting scenario trigger...
          </div>
        ) : (
          messages.map((msg, i) => (
            <LogEntry key={i} entry={msg} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
