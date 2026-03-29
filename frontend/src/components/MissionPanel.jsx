const STATUS_CONFIG = {
  MONITORING:  { label: 'MONITORING',        color: '#38bdf8', bg: '#0d2d4a', pulse: false },
  ANALYZING:   { label: 'ANALYZING',         color: '#fb923c', bg: '#2d1a0d', pulse: true  },
  DECIDING:    { label: 'DECIDING',          color: '#a78bfa', bg: '#1a1a3e', pulse: true  },
  VALIDATING:  { label: 'VALIDATING',        color: '#fbbf24', bg: '#2d2200', pulse: true  },
  AVOIDED:     { label: 'COLLISION AVOIDED', color: '#34d399', bg: '#0d2e1a', pulse: false },
  ERROR:       { label: 'ERROR',             color: '#f87171', bg: '#1a0d0d', pulse: false },
}

function RiskBar({ probability }) {
  const pct = Math.round(probability * 100)
  const color = pct >= 70 ? '#f87171' : pct >= 40 ? '#fb923c' : '#34d399'
  const label = pct >= 70 ? 'CRITICAL' : pct >= 40 ? 'HIGH' : 'MEDIUM'
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.08em' }}>COLLISION PROBABILITY</span>
        <span style={{ fontSize: '10px', color, fontWeight: 'bold' }}>{label}</span>
      </div>
      <div style={{ height: '6px', background: '#1e3a5f', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: '3px', transition: 'width 1s ease',
        }} />
      </div>
      <div style={{ textAlign: 'right', fontSize: '12px', color, fontWeight: 'bold', marginTop: '3px' }}>
        {pct}%
      </div>
    </div>
  )
}

function DecisionCard({ decision }) {
  if (!decision) return null
  const validated = decision.validated
  const color = validated ? '#34d399' : '#f87171'
  const border = validated ? '#34d39933' : '#f8717133'
  const bg = validated ? '#0a1f12' : '#1f0a0a'
  return (
    <div style={{ padding: '10px', background: bg, border: `1px solid ${border}`, borderRadius: '5px', fontSize: '11px' }}>
      <div style={{ color, fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.08em' }}>
        {validated ? '✓ MANEUVER APPROVED' : '✗ MANEUVER REJECTED'}
      </div>
      {decision.negotiation_decision && (
        <div style={{ marginBottom: '6px' }}>
          <div style={{ color: '#475569', fontSize: '10px', marginBottom: '2px' }}>NEGOTIATION</div>
          <div style={{ color: '#94a3b8', lineHeight: 1.5 }}>
            {decision.negotiation_decision.slice(0, 280)}{decision.negotiation_decision.length > 280 ? '…' : ''}
          </div>
        </div>
      )}
      {decision.governance_validation && (
        <div>
          <div style={{ color: '#475569', fontSize: '10px', marginBottom: '2px' }}>GOVERNANCE</div>
          <div style={{ color: '#94a3b8', lineHeight: 1.5 }}>
            {decision.governance_validation.slice(0, 200)}{decision.governance_validation.length > 200 ? '…' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MissionPanel({ status, selectedEvent, decision, isRunning, connected, onTrigger, onReset }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.MONITORING
  const canTrigger = !isRunning && connected && !!selectedEvent

  const prob = selectedEvent?.collision_probability ?? 0
  const tca = selectedEvent?.time_to_closest_approach_hours ?? 0
  const th = Math.floor(tca)
  const tm = Math.floor((tca - th) * 60)

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      background: '#070f1a',
      border: '1px solid #1e3a5f',
      borderRadius: '6px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #1e3a5f', paddingBottom: '8px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8', letterSpacing: '0.1em' }}>
          MISSION CONTROL
        </span>
        <span style={{ fontSize: '10px', color: connected ? '#34d399' : '#f87171' }}>
          {connected ? '● LIVE' : '○ OFFLINE'}
        </span>
      </div>

      {/* Status badge */}
      <div style={{
        flexShrink: 0,
        padding: '6px 12px',
        borderRadius: '4px',
        background: cfg.bg,
        border: `1px solid ${cfg.color}44`,
        color: cfg.color,
        fontSize: '11px',
        fontWeight: 'bold',
        letterSpacing: '0.12em',
        textAlign: 'center',
        animation: cfg.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }}>
        {cfg.label}
      </div>

      {/* Risk info for selected event */}
      {selectedEvent ? (
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
            <span style={{ color: '#e0f0ff' }}>{selectedEvent.sat_a?.name}</span>
            <span style={{ margin: '0 6px' }}>↔</span>
            <span style={{ color: '#e0f0ff' }}>{selectedEvent.sat_b?.name}</span>
          </div>
          <RiskBar probability={prob} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <span style={{ color: '#64748b' }}>TCA</span>
            <span style={{ color: '#e0f0ff', fontWeight: 'bold', fontFamily: 'monospace' }}>
              {String(th).padStart(2, '0')}h {String(tm).padStart(2, '0')}m
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '3px' }}>
            <span style={{ color: '#64748b' }}>MISS DIST</span>
            <span style={{ color: '#e0f0ff', fontFamily: 'monospace' }}>{selectedEvent.miss_distance_km?.toFixed(3)} km</span>
          </div>
        </div>
      ) : (
        <div style={{ flexShrink: 0, fontSize: '10px', color: '#334155', textAlign: 'center', letterSpacing: '0.06em' }}>
          Select a conjunction to enable analysis
        </div>
      )}

      {/* Decision card — scrollable if tall */}
      {decision && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <DecisionCard decision={decision} />
        </div>
      )}

      {/* Spacer pushes controls to bottom */}
      {!decision && <div style={{ flex: 1 }} />}

      {/* Controls */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          onClick={() => onTrigger(false, selectedEvent?.id)}
          disabled={!canTrigger}
          style={{
            padding: '10px',
            background: canTrigger ? '#0d2d4a' : '#0a0f16',
            border: `1px solid ${canTrigger ? '#38bdf8' : '#1e3a5f'}`,
            borderRadius: '4px',
            color: canTrigger ? '#38bdf8' : '#334155',
            fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.1em',
            cursor: canTrigger ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'all 0.2s',
          }}
          onMouseEnter={e => canTrigger && (e.target.style.background = '#1e3a5f')}
          onMouseLeave={e => canTrigger && (e.target.style.background = '#0d2d4a')}
        >
          {isRunning ? '⟳ PIPELINE RUNNING...' : '▶ TRIGGER SCENARIO'}
        </button>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onReset}
            disabled={isRunning}
            style={{
              flex: 1, padding: '7px',
              background: 'transparent',
              border: '1px solid #334155', borderRadius: '4px',
              color: isRunning ? '#334155' : '#64748b',
              fontSize: '11px', letterSpacing: '0.06em',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
            onMouseEnter={e => !isRunning && (e.target.style.borderColor = '#64748b')}
            onMouseLeave={e => !isRunning && (e.target.style.borderColor = '#334155')}
          >
            ↺ RESET
          </button>
          <button
            onClick={() => onTrigger(true, selectedEvent?.id)}
            disabled={!canTrigger}
            style={{
              flex: 1, padding: '7px',
              background: 'transparent',
              border: `1px solid ${canTrigger ? '#f4722544' : '#1e3a5f'}`,
              borderRadius: '4px',
              color: canTrigger ? '#fb923c' : '#334155',
              fontSize: '11px', letterSpacing: '0.04em',
              cursor: canTrigger ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
            onMouseEnter={e => canTrigger && (e.target.style.background = '#2d1a0d')}
            onMouseLeave={e => canTrigger && (e.target.style.background = 'transparent')}
          >
            ⚠ KESSLER
          </button>
        </div>

        {isRunning && (
          <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', animation: 'pulse 1.5s ease-in-out infinite' }}>
            Agents reasoning...
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
