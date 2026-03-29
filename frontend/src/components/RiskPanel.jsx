const STATUS_CONFIG = {
  MONITORING:  { label: 'MONITORING',        color: 'var(--accent)',        pulse: false },
  ANALYZING:   { label: 'ANALYZING',         color: 'var(--text-secondary)', pulse: true  },
  DECIDING:    { label: 'DECIDING',          color: 'var(--accent)',        pulse: true  },
  VALIDATING:  { label: 'VALIDATING',        color: 'var(--text-secondary)', pulse: true  },
  AVOIDED:     { label: 'COLLISION AVOIDED', color: 'var(--status-ok)',     pulse: false },
  ERROR:       { label: 'ERROR',             color: 'var(--status-bad)',    pulse: false },
}

function ProbabilityRing({ probability }) {
  const pct = Math.round(probability * 100)
  // All gray — only the number tells severity
  const size = 140
  const stroke = 5
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - probability)

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <div className="neo-inset" style={{
        position: 'absolute', inset: '-10px', borderRadius: '50%', zIndex: 0,
      }} />
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}>
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="var(--bg-surface)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="var(--accent-dim)" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s var(--ease-out)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: '32px', fontWeight: '600', fontFamily: 'var(--font-mono)',
          color: 'var(--text-heading)', lineHeight: 1,
        }}>
          {pct}%
        </span>
        <span style={{
          fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '4px',
          letterSpacing: '0.1em', fontFamily: 'var(--font-display)',
        }}>
          COLLISION PROB
        </span>
      </div>
    </div>
  )
}

function Countdown({ hours }) {
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  return (
    <div style={{ textAlign: 'center', marginTop: '12px' }}>
      <div style={{
        fontSize: '9px', color: 'var(--text-tertiary)',
        letterSpacing: '0.12em', fontFamily: 'var(--font-display)', marginBottom: '4px',
      }}>
        CLOSEST APPROACH IN
      </div>
      <div style={{
        fontSize: '26px', fontWeight: '600', fontFamily: 'var(--font-mono)',
        color: 'var(--text-heading)', letterSpacing: '2px',
      }}>
        {String(h).padStart(2, '0')}h {String(m).padStart(2, '0')}m
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.MONITORING
  return (
    <div className="neo-inset" style={{
      padding: '8px 12px', textAlign: 'center',
      color: cfg.color, fontSize: '11px', fontWeight: '600',
      letterSpacing: '0.1em', fontFamily: 'var(--font-display)',
      animation: cfg.pulse ? 'pulse 1.8s ease-in-out infinite' : 'none',
    }}>
      {cfg.label}
    </div>
  )
}

function DecisionCard({ decision }) {
  if (!decision) return null
  const mo = decision.chosen_maneuver
  return (
    <div className="neo-inset" style={{
      marginTop: '10px', padding: '12px', fontSize: '11px',
      animation: 'slideIn 0.4s var(--ease-out) both',
    }}>
      <div style={{
        color: 'var(--status-ok)', fontWeight: '600', marginBottom: '8px',
        letterSpacing: '0.08em', fontFamily: 'var(--font-display)', fontSize: '10px',
      }}>
        MANEUVER APPROVED
      </div>
      <div style={{
        color: 'var(--text-secondary)', lineHeight: 1.8,
        fontFamily: 'var(--font-mono)', fontSize: '10px',
      }}>
        <div><span style={{ color: 'var(--text-primary)' }}>Satellite:</span> {mo.sat_id}</div>
        <div><span style={{ color: 'var(--text-primary)' }}>Delta-v:</span> {mo.delta_v} m/s</div>
        <div><span style={{ color: 'var(--text-primary)' }}>Miss dist:</span> {mo.new_miss_distance_km.toFixed(1)} km</div>
        <div><span style={{ color: 'var(--text-primary)' }}>Fuel cost:</span> {(mo.fuel_cost * 100).toFixed(2)}%</div>
      </div>
      {decision.validated && (
        <div style={{
          marginTop: '8px', color: 'var(--status-ok)', fontSize: '9px',
          fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
        }}>
          GOVERNANCE VALIDATED
        </div>
      )}
    </div>
  )
}

export default function RiskPanel({ status, events, decision }) {
  const primaryEvent = events?.[0]
  const prob = primaryEvent?.collision_probability ?? 0
  const tca = primaryEvent?.time_to_closest_approach_hours ?? 0

  return (
    <div className="neo-panel" style={{
      padding: 'var(--space-lg)', display: 'flex',
      flexDirection: 'column', gap: '12px',
    }}>
      <div style={{
        fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-secondary)',
        fontWeight: '600', fontFamily: 'var(--font-display)',
        paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        RISK ASSESSMENT
      </div>
      <ProbabilityRing probability={prob} />
      {tca > 0 && <Countdown hours={tca} />}
      <StatusBadge status={status} />
      {primaryEvent && (
        <div style={{
          fontSize: '10px', color: 'var(--text-tertiary)',
          textAlign: 'center', fontFamily: 'var(--font-mono)',
        }}>
          {primaryEvent.sat_a?.name} — {primaryEvent.sat_b?.name}
        </div>
      )}
      {decision && <DecisionCard decision={decision} />}
    </div>
  )
}
