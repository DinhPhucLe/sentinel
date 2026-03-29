import { useEffect, useRef } from 'react'

const AGENT_LABELS = {
  tracking_agent: 'TRACKING',
  prediction_agent: 'PREDICTION',
  optimization_agent: 'OPTIMIZATION',
  negotiation_agent: 'NEGOTIATION',
  governance_agent: 'GOVERNANCE',
  system: 'SYSTEM',
}

function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour12: false }) }
  catch { return '--:--:--' }
}

function LogEntry({ entry }) {
  const label = AGENT_LABELS[entry.agent] || entry.agent?.toUpperCase()
  const isSystem = entry.agent === 'system'

  return (
    <div style={{
      padding: '8px 12px',
      borderLeft: `2px solid ${isSystem ? 'var(--status-bad)' : 'var(--bg-surface-light)'}`,
      background: 'var(--bg-deep)',
      marginBottom: '4px',
      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
      animation: 'slideIn 0.3s var(--ease-out)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px',
      }}>
        <span style={{
          display: 'inline-block', padding: '1px 8px',
          borderRadius: 'var(--radius-full)',
          fontSize: '9px', fontWeight: '600', letterSpacing: '0.08em',
          fontFamily: 'var(--font-display)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}>
          {label}
        </span>
        <span style={{
          fontSize: '10px', color: 'var(--text-tertiary)',
          marginLeft: 'auto', fontFamily: 'var(--font-mono)',
        }}>
          {formatTime(entry.timestamp)}
        </span>
      </div>
      <pre style={{
        margin: 0, fontSize: '11px', lineHeight: '1.6',
        color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
        wordBreak: 'break-word', fontFamily: 'var(--font-mono)',
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
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: '10px', letterSpacing: '0.14em',
        color: 'var(--text-secondary)', fontWeight: '600',
        fontFamily: 'var(--font-display)',
        display: 'flex', alignItems: 'center',
      }}>
        AGENT REASONING LOG
        <span style={{
          marginLeft: 'auto', color: 'var(--text-tertiary)',
          fontWeight: '400', fontFamily: 'var(--font-mono)', fontSize: '9px',
        }}>
          {messages.length}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {messages.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center',
            color: 'var(--text-tertiary)', fontSize: '11px',
            fontFamily: 'var(--font-body)',
            animation: 'pulse 3s ease-in-out infinite',
          }}>
            Awaiting scenario trigger...
          </div>
        ) : (
          messages.map((msg, i) => <LogEntry key={i} entry={msg} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
