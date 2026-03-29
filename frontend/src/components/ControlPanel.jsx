export default function ControlPanel({ isRunning, connected, onTrigger, onReset }) {
  const canTrigger = !isRunning && connected

  return (
    <div className="neo-panel" style={{
      padding: 'var(--space-lg)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {/* Header */}
      <div style={{
        fontSize: '11px',
        letterSpacing: '0.14em',
        color: 'var(--accent)',
        fontWeight: '600',
        fontFamily: 'var(--font-display)',
        paddingBottom: '10px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        CONTROL
      </div>

      {/* Primary trigger */}
      <button
        className="neo-button"
        onClick={() => onTrigger(false)}
        disabled={!canTrigger}
        style={{
          padding: '14px',
          color: canTrigger ? 'var(--accent)' : 'var(--text-tertiary)',
          fontSize: '12px',
          fontWeight: '600',
          letterSpacing: '0.1em',
          fontFamily: 'var(--font-display)',
          background: canTrigger ? 'var(--accent-subtle)' : 'var(--bg-surface)',
          borderColor: canTrigger ? 'var(--border-accent)' : 'var(--border-subtle)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isRunning ? (
          <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
            PIPELINE RUNNING...
          </span>
        ) : (
          'TRIGGER SCENARIO'
        )}

        {/* Glow effect on hover */}
        {canTrigger && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, transparent 40%, rgba(0,200,240,0.04) 100%)',
            pointerEvents: 'none',
          }} />
        )}
      </button>

      {/* Reset */}
      <button
        className="neo-button"
        onClick={onReset}
        disabled={isRunning}
        style={{
          padding: '10px',
          color: isRunning ? 'var(--text-tertiary)' : 'var(--text-secondary)',
          fontSize: '11px',
          letterSpacing: '0.08em',
          fontFamily: 'var(--font-display)',
          fontWeight: '500',
        }}
      >
        RESET
      </button>

      {/* Kessler cascade */}
      <button
        className="neo-button"
        onClick={() => onTrigger(true)}
        disabled={!canTrigger}
        style={{
          padding: '10px',
          color: canTrigger ? 'var(--text-secondary)' : 'var(--text-tertiary)',
          fontSize: '11px',
          letterSpacing: '0.06em',
          fontFamily: 'var(--font-display)',
          fontWeight: '500',
          borderColor: canTrigger ? 'rgba(224,64,80,0.12)' : 'var(--border-subtle)',
        }}
      >
        TRIGGER KESSLER CASCADE
      </button>

      {isRunning && (
        <div style={{
          fontSize: '10px',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          animation: 'pulse 2s ease-in-out infinite',
          marginTop: '2px',
        }}>
          Agents are reasoning...
        </div>
      )}
    </div>
  )
}
