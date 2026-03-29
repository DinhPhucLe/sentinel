import { useEffect, useState } from 'react'

const STATUS_CONFIG = {
  MONITORING:  { label: 'MONITORING',       color: '#38bdf8', bg: '#0d2d4a', pulse: false },
  ANALYZING:   { label: 'ANALYZING',        color: '#fb923c', bg: '#2d1a0d', pulse: true  },
  DECIDING:    { label: 'DECIDING',         color: '#a78bfa', bg: '#1a1a3e', pulse: true  },
  VALIDATING:  { label: 'VALIDATING',       color: '#fbbf24', bg: '#2d2200', pulse: true  },
  AVOIDED:     { label: 'COLLISION AVOIDED',color: '#34d399', bg: '#0d2e1a', pulse: false },
  ERROR:       { label: 'ERROR',            color: '#f87171', bg: '#1a0d0d', pulse: false },
}

function ProbabilityRing({ probability }) {
  const pct = Math.round(probability * 100)
  const danger = pct >= 70
  const color = pct >= 70 ? '#f87171' : pct >= 40 ? '#fb923c' : '#34d399'
  const size = 140
  const stroke = 8
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - probability)

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="#1e3a5f" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '32px', fontWeight: 'bold', color, lineHeight: 1 }}>
          {pct}%
        </span>
        <span style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
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
      <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.1em' }}>
        CLOSEST APPROACH IN
      </div>
      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#e0f0ff', letterSpacing: '2px' }}>
        {String(h).padStart(2, '0')}h {String(m).padStart(2, '0')}m
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.MONITORING
  return (
    <div style={{
      padding: '6px 14px',
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
  )
}

function DecisionCard({ decision }) {
  if (!decision) return null
  const validated = decision.validated
  const headerColor = validated ? '#34d399' : '#f87171'
  const borderColor = validated ? '#34d39944' : '#f8717144'
  const bg = validated ? '#0a2a1a' : '#2a0a0a'
  return (
    <div style={{
      marginTop: '12px',
      padding: '12px',
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: '6px',
      fontSize: '12px',
    }}>
      <div style={{ color: headerColor, fontWeight: 'bold', marginBottom: '8px', letterSpacing: '0.08em' }}>
        {validated ? '✓ MANEUVER APPROVED' : '✗ MANEUVER REJECTED'}
      </div>
      {decision.negotiation_decision && (
        <div style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: '8px' }}>
          <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>NEGOTIATION</div>
          <div style={{ color: '#cbd5e1', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
            {decision.negotiation_decision.slice(0, 400)}
            {decision.negotiation_decision.length > 400 ? '…' : ''}
          </div>
        </div>
      )}
      {decision.governance_validation && (
        <div style={{ color: '#94a3b8', lineHeight: 1.6 }}>
          <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>GOVERNANCE</div>
          <div style={{ color: '#cbd5e1', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
            {decision.governance_validation.slice(0, 300)}
            {decision.governance_validation.length > 300 ? '…' : ''}
          </div>
        </div>
      )}
      {validated && (
        <div style={{ marginTop: '8px', color: '#34d399', fontSize: '11px' }}>
          ✓ Governance validated
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
    <div style={{
      background: '#070f1a',
      border: '1px solid #1e3a5f',
      borderRadius: '6px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {/* Header */}
      <div style={{
        fontSize: '11px',
        letterSpacing: '0.1em',
        color: '#38bdf8',
        fontWeight: 'bold',
        borderBottom: '1px solid #1e3a5f',
        paddingBottom: '8px',
      }}>
        RISK ASSESSMENT
      </div>

      <ProbabilityRing probability={prob} />
      {tca > 0 && <Countdown hours={tca} />}

      <StatusBadge status={status} />

      {primaryEvent && (
        <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
          {primaryEvent.sat_a?.name} ↔ {primaryEvent.sat_b?.name}
        </div>
      )}

      {decision && <DecisionCard decision={decision} />}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
