export default function ControlPanel({ isRunning, connected, onTrigger, onReset }) {
  const canTrigger = !isRunning && connected

  return (
    <div className="neo-panel" style={{
      padding: 'var(--space-lg)',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <div style={{
        fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-secondary)',
        fontWeight: '600', fontFamily: 'var(--font-display)',
        paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        CONTROL
      </div>

      {/* All buttons use the same neo-btn class */}
      <button className={`neo-btn${canTrigger ? ' primary' : ''}`}
        onClick={() => onTrigger(false)} disabled={!canTrigger}
      >
        {isRunning
          ? <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>PIPELINE RUNNING...</span>
          : 'TRIGGER SCENARIO'}
      </button>

      <button className="neo-btn" onClick={onReset} disabled={isRunning}>
        RESET
      </button>

      <button className="neo-btn" onClick={() => onTrigger(true)} disabled={!canTrigger}>
        TRIGGER KESSLER CASCADE
      </button>

      {isRunning && (
        <div style={{
          fontSize: '10px', color: 'var(--text-tertiary)',
          textAlign: 'center', fontFamily: 'var(--font-mono)',
          animation: 'pulse 2s ease-in-out infinite', marginTop: '2px',
        }}>
          Agents are reasoning...
        </div>
      )}
    </div>
  )
}
