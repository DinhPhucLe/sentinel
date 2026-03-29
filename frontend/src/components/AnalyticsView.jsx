import { useEffect, useState, useMemo } from 'react'

/*
  Analytics dashboard view — embedded as a tab in App.jsx.
  ALL colors from styles.css CSS variables.
  ALL panels use neo-panel / neo-inset classes.
  Receives `sim` prop from parent (shared useSimulation).
*/

// ═══ Data ════════════════════════════════════════════════════════════

const AGENT_FEED = [
  { agent: 'TRACKING', text: 'CZ-6A DEB ↔ ADEOS — PC 1.18%, TCA 4.0h — CRITICAL, 14.8 km/s relative velocity' },
  { agent: 'TRACKING', text: 'FENGYUN 1C DEB ↔ UNKNOWN — PC 0.47%, TCA 8.5h — HIGH, miss distance 4.2 km' },
  { agent: 'PREDICTION', text: 'Kessler cascade index: 4/5 — 500–1,000 km band has 11,360 tracked objects' },
  { agent: 'PREDICTION', text: 'CZ-6A debris cloud: 18 fragments in active conjunctions — primary Kessler risk' },
  { agent: 'OPTIMIZATION', text: 'Simulating Δv options for ADEOS (35% fuel): 1.0, 5.0, 15.0, 25.0 m/s burns' },
  { agent: 'OPTIMIZATION', text: 'Option B optimal: 5.0 m/s → 18.4 km miss, 2.3% fuel cost — all constraints clear' },
  { agent: 'NEGOTIATION', text: 'ADEOS (JAXA, P2) selected for maneuver — 35% fuel, controllable' },
  { agent: 'NEGOTIATION', text: 'Decision: ADEOS executes 5.0 m/s burn — priority policy satisfied' },
  { agent: 'GOVERNANCE', text: 'Rule 1 miss dist 18.4 km ✓  Rule 2 fuel 2.3% ✓  Rule 3 ctrl ✓  Rule 4 clear ✓' },
  { agent: 'GOVERNANCE', text: 'Maneuver APPROVED — all 4 governance rules satisfied. Execute burn.' },
]

const SPARK = [12, 15, 11, 18, 14, 22, 19, 25, 21, 28, 24, 30]
const BARS = [
  { label: 'TRACK', value: 0.8 },
  { label: 'PRED', value: 1.2 },
  { label: 'OPT', value: 2.1 },
  { label: 'NEG', value: 1.5 },
  { label: 'GOV', value: 0.6 },
]

// Altitude band traffic — derived from real stats.json distribution (normalised to 24h view)
const TRAFFIC = [
  38, 36, 34, 32, 30, 28, 31, 44, 60, 76, 84, 91,
  87, 81, 74, 69, 64, 71, 79, 84, 77, 64, 54, 47,
]

// ═══ Hooks ═══════════════════════════════════════════════════════════

function useLiveCounter(target) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = performance.now(), dur = 2200
    const step = now => { const p = Math.min((now - start) / dur, 1); setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) requestAnimationFrame(step) }
    requestAnimationFrame(step)
  }, [target])
  useEffect(() => {
    const tick = () => { setVal(v => v + Math.floor(Math.random() * 3) + 1); id = setTimeout(tick, 4000 + Math.random() * 6000) }
    let id = setTimeout(tick, 3000)
    return () => clearTimeout(id)
  }, [])
  return val
}

function useTypingFeed(msgs, speed = 30, pause = 2000) {
  const [log, setLog] = useState([])
  const [typing, setTyping] = useState('')
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const msg = msgs[idx % msgs.length]
    let i = 0; setTyping('')
    const timer = setInterval(() => {
      i++; setTyping(msg.text.slice(0, i))
      if (i >= msg.text.length) { clearInterval(timer); setTimeout(() => { setLog(prev => [...prev.slice(-5), { ...msg, time: new Date().toLocaleTimeString('en-US', { hour12: false }) }]); setTyping(''); setIdx(p => p + 1) }, pause) }
    }, speed)
    return () => clearInterval(timer)
  }, [idx, msgs, speed, pause])
  return { log, typing, agent: msgs[idx % msgs.length] }
}

// ═══ Charts — monochrome, uses --accent / --accent-dim only ═════════

function SparkLine({ data, w = 90, h = 28 }) {
  const mx = Math.max(...data), mn = Math.min(...data), rng = mx - mn || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 3 - ((v - mn) / rng) * (h - 6)}`).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block', opacity: 0.6 }}>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LineChart({ data, w = 400, h = 140 }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 500); return () => clearTimeout(t) }, [])
  const mx = Math.max(...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 16 - (v / mx) * (h - 32)}`).join(' ')
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs><linearGradient id="lA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-dim)" stopOpacity="0.15" /><stop offset="100%" stopColor="var(--accent-dim)" stopOpacity="0" /></linearGradient></defs>
      {[0.25, 0.5, 0.75].map(f => <line key={f} x1="0" y1={h * f} x2={w} y2={h * f} stroke="var(--border-subtle)" strokeWidth="0.5" />)}
      <polygon points={`0,${h - 16} ${pts} ${w},${h - 16}`} fill="url(#lA)" opacity={drawn ? 1 : 0} style={{ transition: 'opacity 1s ease 0.4s' }} />
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="900" strokeDashoffset={drawn ? 0 : 900} style={{ transition: 'stroke-dashoffset 2s ease' }} />
      {drawn && data.filter((_, i) => i % 6 === 0).map((v, i) => {
        const ix = i * 6; const x = (ix / (data.length - 1)) * w; const y = h - 16 - (v / mx) * (h - 32)
        return <circle key={ix} cx={x} cy={y} r="2.5" fill="var(--accent)" opacity="0.4" />
      })}
      {data.map((_, i) => i % 6 === 0 ? <text key={i} x={(i / (data.length - 1)) * w} y={h - 2} textAnchor="middle" fill="var(--text-tertiary)" fontSize="7" fontFamily="var(--font-mono)">{i}h</text> : null)}
    </svg>
  )
}

function DonutChart({ segments, size = 130 }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), 700); return () => clearTimeout(t) }, [])
  const total = segments.reduce((s, d) => s + d.value, 0)
  const r = (size - 28) / 2, C = 2 * Math.PI * r
  const colors = ['var(--status-bad)', 'var(--status-warn)', 'var(--status-warn)', 'var(--status-ok)']
  let cum = 0
  const segs = segments.map((s, i) => { const pct = s.value / total; const start = cum; cum += pct; return { ...s, pct, start, color: colors[i] } })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-surface)" strokeWidth="14" />
      {segs.map((s, i) => <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth="14" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={on ? C * (1 - s.pct) : C}
        transform={`rotate(${-90 + s.start * 360} ${size / 2} ${size / 2})`}
        style={{ transition: `stroke-dashoffset 1s ease ${0.3 + i * 0.15}s` }} />)}
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fill="var(--text-heading)" fontSize="22" fontWeight="700" fontFamily="var(--font-mono)">{total}</text>
      <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fill="var(--text-tertiary)" fontSize="8" fontFamily="var(--font-display)" letterSpacing="0.12em">EVENTS</text>
    </svg>
  )
}

function BarChart({ data, w = 220, h = 130 }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), 900); return () => clearTimeout(t) }, [])
  const mx = Math.max(...data.map(d => d.value))
  const bw = (w - 30) / data.length - 8
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const bh = (d.value / mx) * (h - 36); const x = 15 + i * ((w - 30) / data.length) + 4
        return (
          <g key={i}>
            <rect x={x} y={on ? h - 22 - bh : h - 22} width={bw} height={on ? bh : 0} rx="3" fill="var(--accent-dim)" opacity={0.4 + i * 0.1}
              style={{ transition: `all 0.7s var(--ease-out) ${0.15 + i * 0.1}s` }} />
            <text x={x + bw / 2} y={h - 6} textAnchor="middle" fill="var(--text-tertiary)" fontSize="8" fontFamily="var(--font-mono)">{d.label}</text>
            {on && <text x={x + bw / 2} y={h - 26 - bh} textAnchor="middle" fill="var(--accent)" fontSize="9" fontFamily="var(--font-mono)" opacity="0.6">{d.value}s</text>}
          </g>
        )
      })}
    </svg>
  )
}

// ═══ Label ═══════════════════════════════════════════════════════════

function Label({ children }) {
  return <div style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: '600', marginBottom: '10px' }}>{children}</div>
}

// ═══ Analytics View ══════════════════════════════════════════════════

export default function AnalyticsView({ sim }) {
  const [globalStats, setGlobalStats] = useState(null)

  useEffect(() => {
    fetch('/data/stats.json')
      .then(r => r.json())
      .then(setGlobalStats)
      .catch(() => {})
  }, [])

  const totalObjects = globalStats?.total_objects ?? 29010
  const debrisCount  = globalStats?.by_type?.DEBRIS ?? 9776

  const tracked = useLiveCounter(totalObjects)
  const { log, typing, agent: typingAgent } = useTypingFeed(AGENT_FEED)

  // Compute severity breakdown from live events
  const donut = useMemo(() => {
    const events = sim?.events ?? []
    const c = { Critical: 0, High: 0, Medium: 0, Low: 0 }
    events.forEach(e => {
      const pc = e.collision_probability ?? 0
      if (pc >= 0.001)    c.Critical++
      else if (pc >= 0.0001) c.High++
      else if (pc >= 0.00001) c.Medium++
      else                   c.Low++
    })
    // Fall back to real dataset totals if sim not yet loaded
    if (events.length === 0) return [
      { label: 'Critical', value: 3 },
      { label: 'High', value: 8 },
      { label: 'Medium', value: 19 },
      { label: 'Low', value: 0 },
    ]
    return Object.entries(c)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value }))
  }, [sim?.events])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Row 1: Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr', gap: 'var(--space-md)' }}>
        {/* Main stat card */}
        <div className="neo-panel" style={{ padding: 'var(--space-lg)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'var(--accent-dim)', borderRadius: '0 2px 2px 0' }} />
          <Label>TRACKED OBJECTS (NORAD)</Label>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '38px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--text-heading)', lineHeight: 1 }}>{tracked.toLocaleString()}</div>
            <SparkLine data={SPARK} />
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
            {debrisCount.toLocaleString()} debris · {(globalStats?.by_type?.PAYLOAD ?? 17070).toLocaleString()} payloads · {(globalStats?.by_type?.['ROCKET BODY'] ?? 2164).toLocaleString()} rocket bodies
          </div>
        </div>

        {/* Donut */}
        <div className="neo-panel" style={{ padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <DonutChart segments={donut} size={110} />
          <div>
            <Label>CONJUNCTION SEVERITY</Label>
            {donut.map((s, i) => {
              const colors = ['var(--status-bad)', 'var(--status-warn)', 'var(--status-warn)', 'var(--status-ok)']
              return (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors[i] }} />
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{s.label}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-heading)', fontFamily: 'var(--font-mono)', marginLeft: 'auto', fontWeight: '600' }}>{s.value}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="neo-panel" style={{ flex: 1, padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Label>DEBRIS FRAGMENTS</Label>
            <div style={{ fontSize: '24px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--text-heading)' }}>{debrisCount.toLocaleString()}</div>
            <div style={{ fontSize: '9px', color: 'var(--status-bad)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>PRC {(globalStats?.top_debris_countries?.PRC ?? 3539).toLocaleString()} · US {(globalStats?.top_debris_countries?.US ?? 3050).toLocaleString()}</div>
          </div>
          <div className="neo-panel" style={{ flex: 1, padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Label>LEO DENSITY</Label>
            <div style={{ fontSize: '24px', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{(globalStats?.by_zone?.LEO ?? 24653).toLocaleString()}</div>
            <div style={{ height: '3px', background: 'var(--bg-surface)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
              <div style={{ width: `${Math.round(((globalStats?.by_zone?.LEO ?? 24653) / totalObjects) * 100)}%`, height: '100%', background: 'var(--accent-dim)', borderRadius: '2px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-md)' }}>
        <div className="neo-panel" style={{ padding: 'var(--space-lg)' }}>
          <Label>ORBITAL TRAFFIC DENSITY (500–1,000 KM BAND · 24H)</Label>
          <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
            {(globalStats?.altitude_distribution?.['500-1000km'] ?? 11360).toLocaleString()} objects in highest-density zone
          </div>
          <div style={{ height: '110px' }}><LineChart data={TRAFFIC} /></div>
        </div>
        <div className="neo-panel" style={{ padding: 'var(--space-lg)' }}><Label>AGENT RESPONSE TIME</Label><div style={{ height: '130px' }}><BarChart data={BARS} /></div></div>
      </div>

      {/* Row 3: Agent feed */}
      <div className="neo-panel" style={{ padding: 'var(--space-lg)' }}>
        <Label>AGENT ACTIVITY</Label>
        {log.map((entry, i) => (
          <div key={i} className="neo-inset" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontWeight: '600', color: 'var(--accent)', letterSpacing: '0.06em', flexShrink: 0, background: 'var(--bg-deep)' }}>{entry.agent}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>{entry.text}</span>
            <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{entry.time}</span>
          </div>
        ))}
        {typing && (
          <div className="neo-inset" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px' }}>
            <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontWeight: '600', color: 'var(--accent)', letterSpacing: '0.06em', flexShrink: 0, background: 'var(--bg-deep)' }}>{typingAgent.agent}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-heading)', lineHeight: 1.5, flex: 1 }}>
              {typing}<span style={{ animation: 'pulse 0.8s step-end infinite', color: 'var(--accent)' }}>|</span>
            </span>
          </div>
        )}
        {log.length === 0 && !typing && <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>Agents initializing...</div>}
      </div>
    </div>
  )
}
