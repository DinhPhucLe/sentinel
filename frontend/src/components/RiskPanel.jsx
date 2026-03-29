import { useEffect, useState } from 'react'

const STATUS_CONFIG = {
  MONITORING:  { label: 'MONITORING',        color: 'var(--accent)',         bg: 'var(--accent-subtle)', pulse: false },
  ANALYZING:   { label: 'ANALYZING',         color: 'var(--text-secondary)', bg: 'rgba(122,132,152,0.08)', pulse: true  },
  DECIDING:    { label: 'DECIDING',          color: 'var(--accent)',         bg: 'var(--accent-subtle)', pulse: true  },
  VALIDATING:  { label: 'VALIDATING',        color: 'var(--text-secondary)', bg: 'rgba(122,132,152,0.08)', pulse: true  },
  AVOIDED:     { label: 'COLLISION AVOIDED', color: 'var(--status-success)', bg: 'rgba(61,220,132,0.08)', pulse: false },
  ERROR:       { label: 'ERROR',             color: 'var(--status-danger)',  bg: 'rgba(224,64,80,0.08)',  pulse: false },
}

function ProbabilityRing({ probability }) {
  const pct = Math.round(probability * 100)
  // Monochrome: low = dim gray, medium = accent, high = stays accent but brighter
  const color = pct >= 70 ? 'var(--status-danger)' : pct >= 40 ? 'var(--accent)' : 'var(--text-secondary)'
  const size = 150
  const stroke = 6
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - probability)

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      {/* Inset well */}
      <div className="neo-inset" style={{
        position: 'absolute',
        inset: '-12px',
        borderRadius: '50%',
        zIndex: 0,
      }} />

      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="var(--bg-surface)" strokeWidth={stroke} />
        {/* Value */}
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 1.2s var(--ease-out), stroke 0.5s',
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        />
      </svg>

      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: '34px',
          fontWeight: '700',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-heading)',
          lineHeight: 1,
        }}>
          {pct}%
        </span>
        <span style={{
          fontSize: '9px',
          color: 'var(--text-tertiary)',
          marginTop: '4px',
          letterSpacing: '0.12em',
          fontFamily: 'var(--font-display)',
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
    <div style={{ textAlign: 'center', marginTop: '16px' }}>
      <div style={{
        fontSize: '10px',
        color: 'var(--text-tertiary)',
        letterSpacing: '0.14em',
        fontFamily: 'var(--font-display)',
        marginBottom: '4px',
      }}>
        CLOSEST APPROACH IN
      </div>
      <div style={{
        fontSize: '28px',
        fontWeight: '700',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-heading)',
        letterSpacing: '2px',
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
      padding: '8px 14px',
      textAlign: 'center',
      color: cfg.color,
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.12em',
      fontFamily: 'var(--font-display)',
      animation: cfg.pulse ? 'pulse 1.8s ease-in-out infinite' : 'none',
      background: cfg.bg,
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
      marginTop: '12px',
      padding: '14px',
      fontSize: '12px',
      animation: 'slideIn 0.4s var(--ease-out) both',
    }}>
      <div style={{
        color: 'var(--status-success)',
        fontWeight: '600',
        marginBottom: '10px',
        letterSpacing: '0.08em',
        fontFamily: 'var(--font-display)',
        fontSize: '11px',
      }}>
        MANEUVER APPROVED
      </div>
      <div style={{
        color: 'var(--text-secondary)',
        lineHeight: 1.8,
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
      }}>
        <div><span style={{ color: 'var(--text-primary)' }}>Satellite:</span> {mo.sat_id}</div>
        <div><span style={{ color: 'var(--text-primary)' }}>Delta-v:</span> {mo.delta_v} m/s</div>
        <div><span style={{ color: 'var(--text-primary)' }}>New miss dist:</span> {mo.new_miss_distance_km.toFixed(1)} km</div>
        <div><span style={{ color: 'var(--text-primary)' }}>Fuel cost:</span> {(mo.fuel_cost * 100).toFixed(2)}%</div>
        {decision.rationale && (
          <div style={{ marginTop: '8px', color: 'var(--text-tertiary)', fontSize: '10px', fontFamily: 'var(--font-body)' }}>
            {decision.rationale?.slice(0, 200)}...
          </div>
        )}
      </div>
      {decision.validated && (
        <div style={{
          marginTop: '10px',
          color: 'var(--status-success)',
          fontSize: '10px',
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.08em',
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
      padding: 'var(--space-lg) var(--space-lg) var(--space-xl)',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
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
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        RISK ASSESSMENT
      </div>

      <ProbabilityRing probability={prob} />
      {tca > 0 && <Countdown hours={tca} />}
      <StatusBadge status={status} />

      {primaryEvent && (
        <div style={{
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
        }}>
          {primaryEvent.sat_a?.name} — {primaryEvent.sat_b?.name}
        </div>
      )}

      {decision && <DecisionCard decision={decision} />}
    </div>
  )
}
