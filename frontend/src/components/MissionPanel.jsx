import { useState, useEffect, useRef } from 'react'

// ── Typewriter hook ──────────────────────────────────────────────────
function useTypewriter(text, speed = 8, enabled = true) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const prevText = useRef('')

  useEffect(() => {
    if (!enabled || !text) { if (!enabled) return; setDisplayed(''); setDone(true); return }
    if (text === prevText.current) { setDisplayed(text); setDone(true); return }
    prevText.current = text
    let i = 0
    setDisplayed('')
    setDone(false)
    const id = setInterval(() => {
      i += 1 + Math.floor(Math.random() * 2)
      if (i >= text.length) { setDisplayed(text); setDone(true); clearInterval(id) }
      else setDisplayed(text.slice(0, i))
    }, speed)
    return () => clearInterval(id)
  }, [text, speed, enabled])

  return [displayed, done]
}

const STATUS_CONFIG = {
  MONITORING:  { label: 'MONITORING',        color: '#38bdf8', bg: '#0d2d4a', pulse: false },
  ANALYZING:   { label: 'ANALYZING',         color: '#fb923c', bg: '#2d1a0d', pulse: true  },
  DECIDING:    { label: 'DECIDING',          color: '#a78bfa', bg: '#1a1a3e', pulse: true  },
  VALIDATING:  { label: 'VALIDATING',        color: '#fbbf24', bg: '#2d2200', pulse: true  },
  AVOIDED:     { label: 'COLLISION AVOIDED', color: '#34d399', bg: '#0d2e1a', pulse: false },
  ERROR:       { label: 'ERROR',             color: '#f87171', bg: '#1a0d0d', pulse: false },
}

function ProbabilityRing({ probability }) {
  const pct = Math.round(probability * 100)
  const color = pct >= 70 ? '#f87171' : pct >= 40 ? '#fb923c' : '#34d399'
  const size = 100
  const stroke = 7
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - probability)
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e3a5f" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '28px', fontWeight: 'bold', color, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: '9px', color: '#64748b', marginTop: '2px', letterSpacing: '0.08em' }}>COLLISION PROB</span>
      </div>
    </div>
  )
}

function formatDecisionText(raw) {
  if (!raw) return []
  return raw.split('\n').filter(l => l.trim()).map(line => {
    const trimmed = line.trim()
    // Key: Value lines
    const kv = trimmed.match(/^([A-Z][A-Za-z\s/()]+?)\s*:\s*(.+)$/)
    if (kv) return { type: 'kv', key: kv[1], value: kv[2] }
    // Bullet lines
    if (/^[-•✓✗]/.test(trimmed)) return { type: 'bullet', text: trimmed.replace(/^[-•]\s*/, '') }
    // Section headers
    if (/^[A-Z][A-Z\s\-_]{3,}$/.test(trimmed)) return { type: 'header', text: trimmed }
    return { type: 'text', text: trimmed }
  })
}

function DecisionCard({ decision }) {
  if (!decision) return null
  const validated = decision.validated
  const color = validated ? '#34d399' : '#f87171'
  const bg = validated ? '#0a1f12' : '#1f0a0a'

  const [negTyped, negDone] = useTypewriter(decision.negotiation_decision || '', 5)
  const [govTyped, govDone] = useTypewriter(decision.governance_validation || '', 5, negDone)

  const negLines = formatDecisionText(negTyped)
  const govLines = formatDecisionText(govTyped)
  const cursor = <span style={{ display: 'inline-block', width: '5px', height: '12px', background: color, marginLeft: '2px', animation: 'cursorBlink 0.8s step-end infinite', verticalAlign: 'text-bottom', opacity: 0.8 }} />

  return (
    <div style={{ borderRadius: '6px', overflow: 'hidden', border: `1px solid ${color}22`, animation: 'slideIn 0.3s var(--ease-out)' }}>
      {/* Status header */}
      <div style={{
        padding: '8px 12px', background: `${color}12`,
        display: 'flex', alignItems: 'center', gap: '8px',
        borderBottom: `1px solid ${color}18`,
      }}>
        <span style={{ fontSize: '13px' }}>{validated ? '✓' : '✗'}</span>
        <span style={{
          fontSize: '10px', fontWeight: '700', color,
          letterSpacing: '0.1em', fontFamily: 'var(--font-display)',
        }}>
          {validated ? 'MANEUVER APPROVED' : 'MANEUVER REJECTED'}
        </span>
      </div>

      <div style={{ padding: '10px 12px', background: bg }}>
        {/* Negotiation section */}
        {negLines.length > 0 && (
          <div style={{ marginBottom: govLines.length ? '10px' : 0 }}>
            <div style={{
              fontSize: '9px', fontWeight: '600', color: '#64748b',
              letterSpacing: '0.12em', fontFamily: 'var(--font-display)',
              marginBottom: '6px', textTransform: 'uppercase',
            }}>
              Negotiation Decision
            </div>
            <DecisionLines lines={negLines} />
            {!negDone && cursor}
          </div>
        )}

        {/* Divider — only show once negotiation is done typing */}
        {negDone && negLines.length > 0 && govLines.length > 0 && (
          <div style={{ height: '1px', background: '#1e3a5f', margin: '0 0 10px' }} />
        )}

        {/* Governance section — starts typing after negotiation finishes */}
        {negDone && govLines.length > 0 && (
          <div>
            <div style={{
              fontSize: '9px', fontWeight: '600', color: '#64748b',
              letterSpacing: '0.12em', fontFamily: 'var(--font-display)',
              marginBottom: '6px', textTransform: 'uppercase',
            }}>
              Safety Validation
            </div>
            <DecisionLines lines={govLines} />
            {!govDone && cursor}
          </div>
        )}
      </div>

      <style>{`
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  )
}

function DecisionLines({ lines }) {
  return (
    <div style={{ fontSize: '10.5px', lineHeight: 1.6, fontFamily: 'var(--font-mono)' }}>
      {lines.map((line, i) => {
        if (line.type === 'header') {
          return (
            <div key={i} style={{
              fontWeight: '700', color: '#94a3b8', fontSize: '10px',
              letterSpacing: '0.08em', margin: '6px 0 3px',
              fontFamily: 'var(--font-display)',
            }}>
              {line.text}
            </div>
          )
        }
        if (line.type === 'kv') {
          return (
            <div key={i} style={{ display: 'flex', gap: '6px', margin: '2px 0' }}>
              <span style={{ color: '#64748b', fontWeight: '600', fontSize: '10px', whiteSpace: 'nowrap' }}>
                {line.key}
              </span>
              <span style={{ color: '#cbd5e1', fontWeight: '500' }}>{line.value}</span>
            </div>
          )
        }
        if (line.type === 'bullet') {
          const isPass = /✓|PASS|approved/i.test(line.text)
          const isFail = /✗|FAIL|rejected/i.test(line.text)
          return (
            <div key={i} style={{ display: 'flex', gap: '6px', margin: '2px 0', paddingLeft: '2px' }}>
              <span style={{
                color: isPass ? '#34d399' : isFail ? '#f87171' : '#64748b',
                flexShrink: 0, fontSize: '7px', marginTop: '4px',
              }}>
                {isPass ? '✓' : isFail ? '✗' : '●'}
              </span>
              <span style={{
                color: isPass ? '#34d399' : isFail ? '#f87171' : '#94a3b8',
                fontWeight: (isPass || isFail) ? '600' : '400',
              }}>
                {line.text}
              </span>
            </div>
          )
        }
        // Default text
        return (
          <div key={i} style={{ color: '#94a3b8', margin: '1px 0' }}>
            {line.text}
          </div>
        )
      })}
    </div>
  )
}

export default function MissionPanel({ status, selectedEvent, decision, isRunning, connected, onSimulate, onPushManeuver, onReset }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.MONITORING
  const canTrigger = !isRunning && connected && !!selectedEvent
  const canPush = !isRunning && decision?.validated

  const prob = selectedEvent?.collision_probability ?? 0
  const tca = selectedEvent?.time_to_closest_approach_hours ?? 0
  const th = Math.floor(tca)
  const tm = Math.floor((tca - th) * 60)

  return (
    <div style={{
      flex: 1, minHeight: 0,
      background: '#070f1a', border: '1px solid #1e3a5f', borderRadius: '6px',
      padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: '0',
      overflow: 'hidden',
    }}>
      {/* Header row — fixed */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #1e3a5f', paddingBottom: '8px', marginBottom: '8px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8', letterSpacing: '0.1em' }}>
          MISSION CONTROL
        </span>
        <span style={{ fontSize: '10px', color: connected ? '#34d399' : '#f87171' }}>
          {connected ? '● LIVE' : '○ OFFLINE'}
        </span>
      </div>

      {/* Status badge — fixed */}
      <div style={{
        flexShrink: 0,
        padding: '5px 12px', marginBottom: '8px',
        borderRadius: '4px', background: cfg.bg, border: `1px solid ${cfg.color}44`,
        color: cfg.color, fontSize: '11px', fontWeight: 'bold',
        letterSpacing: '0.12em', textAlign: 'center',
        animation: cfg.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }}>
        {cfg.label}
      </div>

      {/* Scrollable middle — event info + decision card */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: '8px' }}>
        {selectedEvent ? (
          <>
            <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', marginBottom: '8px' }}>
              <span style={{ color: '#e0f0ff' }}>{selectedEvent.sat_a?.name}</span>
              <span style={{ margin: '0 6px' }}>↔</span>
              <span style={{ color: '#e0f0ff' }}>{selectedEvent.sat_b?.name}</span>
            </div>
            <ProbabilityRing probability={prob} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '10px' }}>
              <span style={{ color: '#64748b' }}>TCA</span>
              <span style={{ color: '#e0f0ff', fontWeight: 'bold', fontFamily: 'monospace' }}>
                {String(th).padStart(2, '0')}h {String(tm).padStart(2, '0')}m
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
              <span style={{ color: '#64748b' }}>MISS DIST</span>
              <span style={{ color: '#e0f0ff', fontFamily: 'monospace' }}>{selectedEvent.miss_distance_km?.toFixed(3)} km</span>
            </div>
            {decision && <div style={{ marginTop: '10px' }}><DecisionCard decision={decision} /></div>}
          </>
        ) : (
          <div style={{ fontSize: '10px', color: '#334155', textAlign: 'center', letterSpacing: '0.06em', paddingTop: '8px' }}>
            Select a conjunction to enable analysis
          </div>
        )}
        {!selectedEvent && decision && <div style={{ marginTop: '8px' }}><DecisionCard decision={decision} /></div>}
      </div>

      {/* Controls — always anchored to bottom */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          onClick={() => onSimulate(selectedEvent?.id)}
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
          {isRunning ? '⟳ AGENTS REASONING...' : '▶ SIMULATE'}
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
            onClick={onPushManeuver}
            disabled={!canPush}
            style={{
              flex: 1, padding: '7px',
              background: 'transparent',
              border: `1px solid ${canPush ? '#34d39944' : '#1e3a5f'}`,
              borderRadius: '4px',
              color: canPush ? '#34d399' : '#334155',
              fontSize: '11px', letterSpacing: '0.04em',
              cursor: canPush ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'all 0.2s',
            }}
            onMouseEnter={e => canPush && (e.target.style.background = '#0a1f12')}
            onMouseLeave={e => canPush && (e.target.style.background = 'transparent')}
          >
            ↑ PUSH MANEUVER
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
