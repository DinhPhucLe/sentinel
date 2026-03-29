export default function ControlPanel({ isRunning, connected, onTrigger, onReset, selectedEvent }) {
  const canTrigger = !isRunning && connected && !!selectedEvent

  return (
    <div style={{
      background: '#070f1a',
      border: '1px solid #1e3a5f',
      borderRadius: '6px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {/* Header */}
      <div style={{
        fontSize: '11px',
        letterSpacing: '0.1em',
        color: '#38bdf8',
        fontWeight: 'bold',
        borderBottom: '1px solid #1e3a5f',
        paddingBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>CONTROL</span>
        <span style={{
          fontSize: '10px',
          color: connected ? '#34d399' : '#f87171',
          fontWeight: 'normal',
        }}>
          {connected ? '● CONNECTED' : '○ CONNECTING...'}
        </span>
      </div>

      {!selectedEvent && !isRunning && (
        <div style={{ fontSize: '10px', color: '#475569', textAlign: 'center', letterSpacing: '0.06em' }}>
          Select a conjunction above to enable
        </div>
      )}

      {/* Primary action */}
      <button
        onClick={() => onTrigger(false, selectedEvent?.id)}
        disabled={!canTrigger}
        style={{
          padding: '12px',
          background: canTrigger ? '#0d2d4a' : '#0a0f16',
          border: `1px solid ${canTrigger ? '#38bdf8' : '#1e3a5f'}`,
          borderRadius: '4px',
          color: canTrigger ? '#38bdf8' : '#334155',
          fontSize: '12px',
          fontWeight: 'bold',
          letterSpacing: '0.1em',
          cursor: canTrigger ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => canTrigger && (e.target.style.background = '#1e3a5f')}
        onMouseLeave={e => canTrigger && (e.target.style.background = '#0d2d4a')}
      >
        {isRunning ? '⟳ PIPELINE RUNNING...' : '▶ TRIGGER SCENARIO'}
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        disabled={isRunning}
        style={{
          padding: '8px',
          background: 'transparent',
          border: '1px solid #334155',
          borderRadius: '4px',
          color: isRunning ? '#334155' : '#64748b',
          fontSize: '11px',
          letterSpacing: '0.08em',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => !isRunning && (e.target.style.borderColor = '#64748b')}
        onMouseLeave={e => !isRunning && (e.target.style.borderColor = '#334155')}
      >
        ↺ RESET
      </button>

      {/* Kessler stretch button */}
      <button
        onClick={() => onTrigger(true, selectedEvent?.id)}
        disabled={!canTrigger}
        style={{
          padding: '8px',
          background: 'transparent',
          border: `1px solid ${canTrigger ? '#f4722544' : '#1e3a5f'}`,
          borderRadius: '4px',
          color: canTrigger ? '#fb923c' : '#334155',
          fontSize: '11px',
          letterSpacing: '0.06em',
          cursor: canTrigger ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => canTrigger && (e.target.style.background = '#2d1a0d')}
        onMouseLeave={e => canTrigger && (e.target.style.background = 'transparent')}
      >
        ⚠ TRIGGER KESSLER CASCADE
      </button>

      {isRunning && (
        <div style={{
          fontSize: '10px',
          color: '#64748b',
          textAlign: 'center',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          Agents are reasoning...
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
