import { useEffect, useState, useCallback } from 'react'
import { useSimulation } from '../hooks/useSimulation'

// ═══ Feed Data ═══════════════════════════════════════════════════════

const AGENT_FEED = [
  { agent: 'TRACKING', color: '#38bdf8', text: 'Scanning LEO sector 7... 3 new objects detected in surveillance zone' },
  { agent: 'TRACKING', color: '#38bdf8', text: 'Conjunction alert: SAT-001 \u2194 SAT-002 \u2014 miss distance 0.85 km, TCA 4.2h' },
  { agent: 'PREDICTION', color: '#a78bfa', text: 'Computing collision probability matrix for active conjunctions...' },
  { agent: 'PREDICTION', color: '#a78bfa', text: 'Kessler cascade risk: MODERATE \u2014 3 debris fragments in proximity chain' },
  { agent: 'OPTIMIZATION', color: '#34d399', text: 'Simulating 3 maneuver options: \u0394v = 1.0, 5.0, 15.0 m/s for SAT-002' },
  { agent: 'OPTIMIZATION', color: '#34d399', text: 'Trade-off complete \u2014 Option B (5.0 m/s) optimal: 12.4 km miss, 2.1% fuel' },
  { agent: 'NEGOTIATION', color: '#fb923c', text: 'Cross-operator negotiation: SpaceX Starlink vs USAF GPS initiated' },
  { agent: 'NEGOTIATION', color: '#fb923c', text: 'Decision: SAT-002 (Starlink) maneuvers \u2014 lower priority, sufficient fuel' },
  { agent: 'GOVERNANCE', color: '#f472b6', text: 'Validating safety constraints: miss > 5km \u2713  fuel < 30% \u2713  controllable \u2713' },
  { agent: 'GOVERNANCE', color: '#f472b6', text: 'Maneuver APPROVED \u2014 all governance rules satisfied. Execute T-2:00:00' },
]

const TRAFFIC_24H = [42, 38, 35, 32, 28, 25, 30, 45, 62, 78, 85, 92, 88, 82, 75, 70, 65, 72, 80, 85, 78, 65, 55, 48]
const SPARK_DATA = [12, 15, 11, 18, 14, 22, 19, 25, 21, 28, 24, 30]

const BAR_DATA = [
  { label: 'TRACK', value: 0.8, color: '#38bdf8' },
  { label: 'PRED', value: 1.2, color: '#a78bfa' },
  { label: 'OPT', value: 2.1, color: '#34d399' },
  { label: 'NEG', value: 1.5, color: '#fb923c' },
  { label: 'GOV', value: 0.6, color: '#f472b6' },
]

const DONUT_SEG = [
  { label: 'Critical', value: 3, color: '#ef4444' },
  { label: 'High', value: 4, color: '#f97316' },
  { label: 'Medium', value: 5, color: '#eab308' },
  { label: 'Low', value: 12, color: '#22c55e' },
]

const ALERTS = [
  { sev: 'critical', text: 'SAT-001 \u2194 SAT-002 collision prob 82%', time: '2m ago' },
  { sev: 'high', text: 'DEBRIS-001 entering GPS constellation altitude', time: '8m ago' },
  { sev: 'medium', text: 'Starlink fuel reserves below 40% threshold', time: '15m ago' },
  { sev: 'low', text: 'ISS orbit adjustment scheduled next pass', time: '1h ago' },
  { sev: 'medium', text: 'New debris field detected at 550 km orbit', time: '2h ago' },
]

const SEV_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }

const MOCK_SATS = [
  { id: 'SAT-001', name: 'GPS-IIF-12', operator: 'GPS', priority: 1, altitude_km: 20200, fuel_remaining: 0.85, controllable: true },
  { id: 'SAT-002', name: 'STARLINK-4521', operator: 'STARLINK', priority: 2, altitude_km: 550, fuel_remaining: 0.62, controllable: true },
  { id: 'SAT-003', name: 'ISS (ZARYA)', operator: 'ISS', priority: 1, altitude_km: 408, fuel_remaining: 0.78, controllable: true },
  { id: 'DEBRIS-001', name: 'COSMOS-2251-DEB', operator: 'DEBRIS', priority: 4, altitude_km: 780, fuel_remaining: 0, controllable: false },
]

// ═══ Hooks ═══════════════════════════════════════════════════════════

function useLiveCounter(target, live = true) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = performance.now(), dur = 2200
    const step = now => { const p = Math.min((now - start) / dur, 1); setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) requestAnimationFrame(step) }
    requestAnimationFrame(step)
  }, [target])
  useEffect(() => {
    if (!live) return
    const tick = () => { setVal(v => v + Math.floor(Math.random() * 3) + 1); id = setTimeout(tick, 3000 + Math.random() * 6000) }
    let id = setTimeout(tick, 3000)
    return () => clearTimeout(id)
  }, [live])
  return val
}

function useLiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return t.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' })
}

function useTypingFeed(msgs, speed = 28, pause = 1800) {
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

// ═══ SVG Charts ══════════════════════════════════════════════════════

function SparkLine({ data, w = 90, h = 28, color = '#6366f1' }) {
  const mx = Math.max(...data), mn = Math.min(...data), rng = mx - mn || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 3 - ((v - mn) / rng) * (h - 6)}`).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block', opacity: 0.8 }}>
      <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#spk)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LineChart({ data, w = 400, h = 140 }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 600); return () => clearTimeout(t) }, [])
  const mx = Math.max(...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 16 - (v / mx) * (h - 32)}`).join(' ')
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="lnG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" /><stop offset="100%" stopColor="#6366f1" stopOpacity="0" /></linearGradient>
        <linearGradient id="lnS" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#ec4899" /></linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(f => <line key={f} x1="0" y1={h * f} x2={w} y2={h * f} stroke="#1f2331" strokeWidth="0.5" />)}
      <polygon points={`0,${h - 16} ${pts} ${w},${h - 16}`} fill="url(#lnG)" opacity={drawn ? 1 : 0} style={{ transition: 'opacity 1s ease 0.5s' }} />
      <polyline points={pts} fill="none" stroke="url(#lnS)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="900" strokeDashoffset={drawn ? 0 : 900} style={{ transition: 'stroke-dashoffset 2s ease' }} />
      {drawn && data.filter((_, i) => i % 4 === 0).map((v, i) => {
        const ix = i * 4; const x = (ix / (data.length - 1)) * w; const y = h - 16 - (v / mx) * (h - 32)
        return <circle key={ix} cx={x} cy={y} r="2.5" fill="#6366f1" opacity="0.7" style={{ animation: `fadeIn 0.3s ease ${1.5 + i * 0.1}s both` }} />
      })}
      {data.map((_, i) => i % 6 === 0 ? <text key={i} x={(i / (data.length - 1)) * w} y={h - 2} textAnchor="middle" fill="#475569" fontSize="7" fontFamily="monospace">{i}h</text> : null)}
    </svg>
  )
}

function DonutChart({ segments, size = 150 }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), 800); return () => clearTimeout(t) }, [])
  const total = segments.reduce((s, d) => s + d.value, 0)
  const r = (size - 28) / 2, C = 2 * Math.PI * r
  let cum = 0
  const segs = segments.map(s => { const pct = s.value / total; const start = cum; cum += pct; return { ...s, pct, start } })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2331" strokeWidth="16" />
      {segs.map((s, i) => <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth="16" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={on ? C * (1 - s.pct) : C}
        transform={`rotate(${-90 + s.start * 360} ${size / 2} ${size / 2})`}
        style={{ transition: `stroke-dashoffset 1s ease ${0.3 + i * 0.15}s` }} />)}
      <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fill="#f1f5f9" fontSize="26" fontWeight="700" fontFamily="monospace">{total}</text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill="#475569" fontSize="9" fontFamily="sans-serif" letterSpacing="0.12em">EVENTS</text>
    </svg>
  )
}

function BarChart({ data, w = 220, h = 130 }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), 1000); return () => clearTimeout(t) }, [])
  const mx = Math.max(...data.map(d => d.value))
  const bw = (w - 30) / data.length - 8
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const bh = (d.value / mx) * (h - 36); const x = 15 + i * ((w - 30) / data.length) + 4
        return (
          <g key={i}>
            <rect x={x} y={on ? h - 22 - bh : h - 22} width={bw} height={on ? bh : 0} rx="4" fill={d.color} opacity="0.85"
              style={{ transition: `all 0.7s ease ${0.15 + i * 0.1}s` }} />
            <text x={x + bw / 2} y={h - 6} textAnchor="middle" fill="#475569" fontSize="8" fontFamily="monospace">{d.label}</text>
            {on && <text x={x + bw / 2} y={h - 26 - bh} textAnchor="middle" fill={d.color} fontSize="9" fontFamily="monospace"
              style={{ animation: `fadeIn 0.3s ease ${1 + i * 0.1}s both` }}>{d.value}s</text>}
          </g>
        )
      })}
    </svg>
  )
}

// ═══ Sidebar ═════════════════════════════════════════════════════════

function SideIcon({ children, active, onClick, label }) {
  return (
    <button onClick={onClick} title={label} style={{
      width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: '10px', border: 'none', cursor: 'pointer', position: 'relative',
      background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
      color: active ? '#818cf8' : '#475569', transition: 'all 0.2s',
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; e.currentTarget.style.color = '#64748b' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569' } }}
    >
      {active && <div style={{ position: 'absolute', left: '-12px', top: '50%', transform: 'translateY(-50%)', width: '3px', height: '18px', borderRadius: '0 3px 3px 0', background: '#6366f1' }} />}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
    </button>
  )
}

function Sidebar({ active, onNav, onLaunch }) {
  return (
    <div style={{ width: '62px', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '16px', gap: '6px', background: '#111318', borderRight: '1px solid #1f2331', flexShrink: 0 }}>
      <div className="sentinel-mark" onClick={onLaunch} title="Launch Mission Control" style={{ marginBottom: '12px' }}>S</div>

      <SideIcon active={active === 'dashboard'} onClick={() => onNav('dashboard')} label="Dashboard">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </SideIcon>
      <SideIcon active={active === 'satellites'} onClick={() => onNav('satellites')} label="Satellites">
        <circle cx="12" cy="12" r="3" /><path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
      </SideIcon>
      <SideIcon active={active === 'analytics'} onClick={() => onNav('analytics')} label="Analytics">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </SideIcon>
      <SideIcon active={active === 'alerts'} onClick={() => onNav('alerts')} label="Alerts">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
      </SideIcon>

      <div style={{ flex: 1 }} />
      <button onClick={onLaunch} title="Launch Mission Control" style={{
        width: '38px', height: '38px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.3)',
        background: 'rgba(99,102,241,0.08)', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '16px', transition: 'all 0.2s',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
      </button>
    </div>
  )
}

// ═══ Card ════════════════════════════════════════════════════════════

function Card({ children, style, hover = true, ...props }) {
  return (
    <div style={{ background: '#151821', borderRadius: '14px', border: '1px solid #1f2331', padding: '20px', transition: 'border-color 0.25s, box-shadow 0.25s', ...style }} {...props}
      onMouseEnter={hover ? e => { e.currentTarget.style.borderColor = '#2a3a5a'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.2)' } : undefined}
      onMouseLeave={hover ? e => { e.currentTarget.style.borderColor = '#1f2331'; e.currentTarget.style.boxShadow = 'none' } : undefined}
    >{children}</div>
  )
}

function CardLabel({ children }) {
  return <div style={{ fontSize: '10px', letterSpacing: '0.14em', color: '#64748b', fontFamily: 'sans-serif', fontWeight: '600', marginBottom: '10px' }}>{children}</div>
}

// ═══ Main Landing Page ═══════════════════════════════════════════════

export default function LandingPage({ onEnter }) {
  const { satellites, events, connected, status } = useSimulation()
  const [tab, setTab] = useState('agents')
  const [sideNav, setSideNav] = useState('dashboard')
  const clock = useLiveClock()
  const tracked = useLiveCounter(65247)
  const maneuvers = useLiveCounter(342, false)
  const { log, typing, agent: typingAgent } = useTypingFeed(AGENT_FEED)

  const handleNav = useCallback((id) => {
    setSideNav(id)
    if (id === 'satellites') setTab('satellites')
    else if (id === 'alerts') setTab('alerts')
    else if (id === 'analytics') setTab('agents')
    else setTab('agents')
  }, [])

  const satList = satellites.length ? satellites : MOCK_SATS

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0c0e14', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active={sideNav} onNav={handleNav} onLaunch={onEnter} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 24px', borderBottom: '1px solid #1f2331', background: '#111318', flexShrink: 0 }}>
          <span className="sentinel-logo" style={{ fontSize: '18px' }}>SENTINEL</span>
          <div style={{ width: '1px', height: '20px', background: '#1f2331' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444', boxShadow: connected ? '0 0 8px #22c55e' : 'none', animation: 'dotPulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: connected ? '#22c55e' : '#ef4444', letterSpacing: '0.08em', fontWeight: '600' }}>{connected ? 'LIVE' : 'DEMO'}</span>
          </div>
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#475569' }}>{clock} UTC</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '10px', fontFamily: "'Space Grotesk', sans-serif", color: '#475569', letterSpacing: '0.1em' }}>PIPELINE: {status}</span>
          <button onClick={onEnter} style={{
            padding: '8px 20px', borderRadius: '8px', border: '1px solid #6366f1', cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(236,72,153,0.1))',
            color: '#a5b4fc', fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em',
            fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.25s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(236,72,153,0.2))'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(236,72,153,0.1))'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
          >LAUNCH MISSION CONTROL</button>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Row 1: Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr', gap: '16px', animation: 'fadeIn 0.6s ease both' }}>
            <Card style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)', border: 'none', position: 'relative', overflow: 'hidden', color: '#fff' }}>
              <div style={{ position: 'absolute', top: 0, left: '-100%', width: '200%', height: '100%', background: 'linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.07) 50%, transparent 70%)', animation: 'shimmer 4s ease-in-out infinite' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.16em', opacity: 0.8, fontFamily: "'Space Grotesk', sans-serif", marginBottom: '8px' }}>TRACKED OBJECTS</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '42px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{tracked.toLocaleString()}</div>
                  <SparkLine data={SPARK_DATA} color="rgba(255,255,255,0.7)" />
                </div>
                <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '8px', fontFamily: "'JetBrains Mono', monospace" }}>+{Math.floor(Math.random() * 5 + 3)} in last hour</div>
              </div>
            </Card>

            <Card style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <DonutChart segments={DONUT_SEG} size={120} />
              <div>
                <CardLabel>CONJUNCTION SEVERITY</CardLabel>
                {DONUT_SEG.map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{s.label}</span>
                    <span style={{ fontSize: '11px', color: '#f1f5f9', fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto', fontWeight: '600' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <CardLabel>MANEUVERS EXECUTED</CardLabel>
                <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", color: '#f1f5f9' }}>{maneuvers}</div>
                <div style={{ fontSize: '10px', color: '#22c55e', fontFamily: "'JetBrains Mono', monospace", marginTop: '4px' }}>+12 this week</div>
              </Card>
              <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <CardLabel>DETECTION RATE</CardLabel>
                <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", color: '#22c55e' }}>99.7%</div>
                <div style={{ flex: 0, height: '4px', background: '#1f2331', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
                  <div style={{ width: '99.7%', height: '100%', background: 'linear-gradient(90deg, #22c55e, #34d399)', borderRadius: '2px' }} />
                </div>
              </Card>
            </div>
          </div>

          {/* Row 2: Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', animation: 'fadeIn 0.6s ease 0.2s both' }}>
            <Card><CardLabel>ORBITAL TRAFFIC (24H)</CardLabel><div style={{ height: '140px' }}><LineChart data={TRAFFIC_24H} /></div></Card>
            <Card><CardLabel>AGENT RESPONSE TIME (SEC)</CardLabel><div style={{ height: '140px' }}><BarChart data={BAR_DATA} /></div></Card>
          </div>

          {/* Row 3: Tabs */}
          <div style={{ animation: 'fadeIn 0.6s ease 0.4s both' }}>
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #1f2331' }}>
              {[{ id: 'agents', label: 'Agent Activity', count: log.length + (typing ? 1 : 0) }, { id: 'satellites', label: 'Satellites', count: satList.length }, { id: 'alerts', label: 'Alerts', count: ALERTS.length }].map(t => (
                <button key={t.id} onClick={() => { setTab(t.id); setSideNav(t.id === 'agents' ? 'dashboard' : t.id) }} style={{
                  padding: '10px 20px', border: 'none', cursor: 'pointer', background: 'transparent',
                  color: tab === t.id ? '#f1f5f9' : '#475569', fontSize: '12px', fontWeight: '600',
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em',
                  borderBottom: tab === t.id ? '2px solid #6366f1' : '2px solid transparent',
                  transition: 'all 0.2s', marginBottom: '-1px',
                }}
                  onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.color = '#94a3b8' }}
                  onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.color = '#475569' }}
                >
                  {t.label}
                  <span style={{ marginLeft: '8px', fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: tab === t.id ? 'rgba(99,102,241,0.15)' : '#1f2331', color: tab === t.id ? '#818cf8' : '#475569', fontFamily: "'JetBrains Mono', monospace" }}>{t.count}</span>
                </button>
              ))}
            </div>

            <Card style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none', minHeight: '220px' }}>
              {tab === 'agents' && (
                <div>
                  {log.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: '1px solid #1f2331' }}>
                      <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '6px', background: `${entry.color}18`, color: entry.color, fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', flexShrink: 0, border: `1px solid ${entry.color}30` }}>{entry.agent}</span>
                      <span style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, flex: 1 }}>{entry.text}</span>
                      <span style={{ fontSize: '10px', color: '#475569', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{entry.time}</span>
                    </div>
                  ))}
                  {typing && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', animation: 'fadeIn 0.2s ease' }}>
                      <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '6px', background: `${typingAgent.color}18`, color: typingAgent.color, fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', flexShrink: 0, border: `1px solid ${typingAgent.color}30` }}>{typingAgent.agent}</span>
                      <span style={{ fontSize: '12px', color: '#f1f5f9', lineHeight: 1.5, flex: 1 }}>
                        {typing}<span style={{ animation: 'blink 0.8s step-end infinite', color: typingAgent.color }}>|</span>
                      </span>
                    </div>
                  )}
                  {log.length === 0 && !typing && <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>Agents initializing...</div>}
                </div>
              )}

              {tab === 'satellites' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {satList.map(sat => {
                    const fuel = (sat.fuel_remaining * 100).toFixed(0)
                    const fc = fuel > 60 ? '#22c55e' : fuel > 30 ? '#eab308' : '#ef4444'
                    return (
                      <div key={sat.id} style={{ padding: '14px', borderRadius: '10px', background: '#0c0e14', border: '1px solid #1f2331', transition: 'border-color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#2a3a5a'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#1f2331'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', fontFamily: "'Space Grotesk', sans-serif" }}>{sat.name}</span>
                          <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: '600', color: sat.controllable ? '#22c55e' : '#ef4444', background: sat.controllable ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${sat.controllable ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>{sat.controllable ? 'CTRL' : 'INERT'}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#475569', fontFamily: "'JetBrains Mono', monospace", display: 'flex', gap: '10px', marginBottom: '8px' }}>
                          <span>{sat.id}</span><span>P{sat.priority}</span><span style={{ color: '#818cf8' }}>{sat.operator}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#475569' }}>
                          <span>ALT {sat.altitude_km.toLocaleString()} km</span>
                          <div style={{ flex: 1, height: '3px', background: '#1f2331', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${fuel}%`, height: '100%', background: fc, borderRadius: '2px' }} />
                          </div>
                          <span style={{ color: fc, fontWeight: '600' }}>FUEL {fuel}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'alerts' && (
                <div>
                  {ALERTS.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #1f2331' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: SEV_COLOR[a.sev], boxShadow: a.sev === 'critical' ? `0 0 8px ${SEV_COLOR[a.sev]}` : 'none', animation: a.sev === 'critical' ? 'dotPulse 1.5s infinite' : 'none', flexShrink: 0 }} />
                      <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '6px', background: `${SEV_COLOR[a.sev]}15`, color: SEV_COLOR[a.sev], fontWeight: '700', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0, border: `1px solid ${SEV_COLOR[a.sev]}30` }}>{a.sev}</span>
                      <span style={{ fontSize: '12px', color: '#94a3b8', flex: 1 }}>{a.text}</span>
                      <span style={{ fontSize: '10px', color: '#475569', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{a.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0%,100% { transform: translateX(-50%); } 50% { transform: translateX(50%); } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes dotPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}
