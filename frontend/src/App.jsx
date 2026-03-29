import { useState, useEffect } from 'react'
import { useSimulation } from './hooks/useSimulation'
import AgentLog from './components/AgentLog'
import OrbitCanvas from './components/OrbitCanvas'
import AnalyticsView from './components/AnalyticsView'
import LandingPage from './components/LandingPage'
import SentinelLogo, { SentinelMark } from './components/SentinelLogo'
import TriageTable from './components/TriageTable'
import MissionPanel from './components/MissionPanel'
import ManeuverQueue from './components/ManeuverQueue'
import LaunchTransition from './components/LaunchTransition'

// ═══ Sidebar ═════════════════════════════════════════════════════════

function SideIcon({ children, active, onClick, label }) {
  return (
    <button onClick={onClick} title={label} style={{
      width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', position: 'relative',
      background: active ? 'var(--accent-subtle)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text-tertiary)',
      transition: 'all 0.25s var(--ease-out)',
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(94,170,187,0.04)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)' } }}
    >
      {active && <div style={{ position: 'absolute', left: '-11px', top: '50%', transform: 'translateY(-50%)', width: '2px', height: '18px', borderRadius: '0 2px 2px 0', background: 'var(--accent-dim)' }} />}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
    </button>
  )
}

function Sidebar({ active, onNav, onBack }) {
  return (
    <div style={{
      width: '52px', flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 0', gap: '6px',
      background: 'var(--bg-elevated)',
      borderRight: '1px solid var(--border-subtle)',
    }}>
      <div style={{ marginBottom: '8px' }}><SentinelMark size={32} /></div>
      <div style={{ width: '28px', height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

      {/* Dashboard */}
      <SideIcon active={active === 'dashboard'} onClick={() => onNav('dashboard')} label="Dashboard">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </SideIcon>

      {/* Mission Control */}
      <SideIcon active={active === 'mission'} onClick={() => onNav('mission')} label="Mission Control">
        <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" />
        <line x1="12" y1="3" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="21" />
        <line x1="3" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="21" y2="12" />
      </SideIcon>

      {/* Satellites */}
      <SideIcon active={active === 'satellites'} onClick={() => onNav('satellites')} label="Satellites">
        <path d="M12 2L8 6l4 4 4-4-4-4z" /><path d="M2 12l4 4 4-4-4-4-4 4z" />
        <path d="M12 22l4-4-4-4-4 4 4 4z" /><path d="M22 12l-4-4-4 4 4 4 4-4z" />
      </SideIcon>

      {/* Alerts */}
      <SideIcon active={active === 'alerts'} onClick={() => onNav('alerts')} label="Alerts">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </SideIcon>

      {/* Spacer */}
      <div style={{ flex: 1 }} />
      <div style={{ width: '28px', height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />

      {/* Back to landing */}
      <SideIcon onClick={onBack} label="Back to Landing">
        <polyline points="15 18 9 12 15 6" />
      </SideIcon>
    </div>
  )
}

// ═══ Header ══════════════════════════════════════════════════════════

function useLiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return t.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC'
}

const STATUS_COLORS = {
  MONITORING: 'var(--accent)', ANALYZING: 'var(--status-warn)',
  DECIDING: '#a78bfa', VALIDATING: 'var(--status-warn)',
  AVOIDED: 'var(--status-ok)', ERROR: 'var(--status-bad)',
}

function Header({ connected, status, clock }) {
  return (
    <div style={{
      height: '44px', flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 var(--space-lg)', gap: '16px',
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <SentinelLogo size={14} animate={false} />
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{clock}</span>
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: '600', color: STATUS_COLORS[status] || 'var(--accent)', letterSpacing: '0.08em' }}>
        {status}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: connected ? 'var(--status-ok)' : 'var(--status-bad)', fontFamily: 'var(--font-mono)' }}>
        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: connected ? 'var(--status-ok)' : 'var(--status-bad)', animation: connected ? 'dotPulse 2s ease-in-out infinite' : 'none' }} />
        {connected ? 'LIVE' : 'OFFLINE'}
      </div>
    </div>
  )
}

// ═══ Mission View (our working layout) ═══════════════════════════════

// ── Expand button for panels ─────────────────────────────────────────
function ExpandBtn({ expanded, onClick }) {
  return (
    <button onClick={onClick} title={expanded ? 'Collapse' : 'Expand'} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
      color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center',
      transition: 'color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {expanded
          ? <><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></>
          : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>
        }
      </svg>
    </button>
  )
}

// ── Overlay panel (fullscreen expand) ────────────────────────────────
function ExpandedOverlay({ children, onClose, title }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeInUp 0.25s var(--ease-out)',
    }} onClick={onClose}>
      <div style={{
        width: '85vw', height: '80vh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header bar */}
        <div style={{
          padding: '10px 16px', flexShrink: 0,
          display: 'flex', alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}>
          <span style={{
            fontSize: '10px', fontWeight: '600', letterSpacing: '0.12em',
            color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
          }}>{title}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', padding: '4px',
            transition: 'color 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function MissionView({ sim }) {
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [simMode, setSimMode] = useState(null)
  const [maneuverQueue, setManeuverQueue] = useState([])
  const [expandedPanel, setExpandedPanel] = useState(null) // 'agent' | 'mission' | 'queue' | null

  const handleSelect = (ev) => setSelectedEvent(prev => prev?.id === ev.id ? null : ev)

  const handleReset = () => {
    sim.reset()
    setSelectedEvent(null)
    setSimMode(null)
  }

  const handleSimulate = (eventId) => {
    if (!selectedEvent) return
    setSimMode({ satAId: selectedEvent.sat_a?.id, satBId: selectedEvent.sat_b?.id })
    sim.triggerScenario(false, eventId)
  }

  const handleEndSim = () => setSimMode(null)

  const handlePushManeuver = () => {
    if (!sim.decision || !selectedEvent) return
    setManeuverQueue(prev => [...prev, {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      satA: selectedEvent.sat_a,
      satB: selectedEvent.sat_b,
      decision: sim.decision,
    }])
  }

  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: 'grid',
      gridTemplateColumns: '3fr 2fr',
      gap: 'var(--space-md)',
      overflow: 'hidden',
    }}>
      {/* Left — orbit canvas + bottom panels */}
      <div style={{ display: 'grid', gridTemplateRows: '1fr 240px', gap: 'var(--space-md)', minHeight: 0 }}>
        <div className="neo-panel" style={{ overflow: 'hidden', minHeight: 0, height: '100%' }}>
          <OrbitCanvas
            satellites={sim.satellites}
            events={sim.events}
            decision={sim.decision}
            status={sim.status}
            simMode={simMode}
            agentMessages={sim.agentMessages}
            onEndSim={handleEndSim}
          />
        </div>
        {/* Bottom row: Agent Log + Maneuver Queue 50/50 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', minHeight: 0 }}>
          <div style={{ position: 'relative', minHeight: 0 }}>
            <div style={{ position: 'absolute', top: '6px', right: '24px', zIndex: 2 }}>
              <ExpandBtn expanded={false} onClick={() => setExpandedPanel('agent')} />
            </div>
            <AgentLog messages={sim.agentMessages} />
          </div>
          <div style={{ position: 'relative', minHeight: 0 }}>
            <div style={{ position: 'absolute', top: '6px', right: '24px', zIndex: 2 }}>
              <ExpandBtn expanded={false} onClick={() => setExpandedPanel('queue')} />
            </div>
            <ManeuverQueue queue={maneuverQueue} />
          </div>
        </div>
      </div>

      {/* Right — triage table + mission panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', minHeight: 0, overflow: 'hidden' }}>
        <TriageTable events={sim.events} selectedId={selectedEvent?.id} onSelect={handleSelect} />
        <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 2 }}>
            <ExpandBtn expanded={false} onClick={() => setExpandedPanel('mission')} />
          </div>
          <MissionPanel
            status={sim.status}
            selectedEvent={selectedEvent}
            decision={sim.decision}
            isRunning={sim.isRunning}
            connected={sim.connected}
            onSimulate={handleSimulate}
            onPushManeuver={handlePushManeuver}
            onReset={handleReset}
          />
        </div>
      </div>

      {/* ── Expanded overlays ── */}
      {expandedPanel === 'agent' && (
        <ExpandedOverlay title="AGENT LOG" onClose={() => setExpandedPanel(null)}>
          <AgentLog messages={sim.agentMessages} />
        </ExpandedOverlay>
      )}
      {expandedPanel === 'mission' && (
        <ExpandedOverlay title="MISSION CONTROL" onClose={() => setExpandedPanel(null)}>
          <div style={{ height: '100%', overflow: 'auto', padding: 'var(--space-md)' }}>
            <MissionPanel
              status={sim.status}
              selectedEvent={selectedEvent}
              decision={sim.decision}
              isRunning={sim.isRunning}
              connected={sim.connected}
              onSimulate={handleSimulate}
              onPushManeuver={handlePushManeuver}
              onReset={handleReset}
            />
          </div>
        </ExpandedOverlay>
      )}
      {expandedPanel === 'queue' && (
        <ExpandedOverlay title="MANEUVER QUEUE" onClose={() => setExpandedPanel(null)}>
          <ManeuverQueue queue={maneuverQueue} />
        </ExpandedOverlay>
      )}
    </div>
  )
}

// ═══ Satellites View ═════════════════════════════════════════════════

function SatellitesView({ satellites }) {
  const list = satellites.length ? satellites : [
    { id: 'SAT-001', name: 'GPS-IIF-12', operator: 'GPS', priority: 1, altitude_km: 20200, fuel_remaining: 0.85, controllable: true },
    { id: 'SAT-002', name: 'STARLINK-4521', operator: 'STARLINK', priority: 2, altitude_km: 550, fuel_remaining: 0.62, controllable: true },
    { id: 'SAT-003', name: 'ISS (ZARYA)', operator: 'ISS', priority: 1, altitude_km: 408, fuel_remaining: 0.78, controllable: true },
    { id: 'DEBRIS-001', name: 'COSMOS-2251-DEB', operator: 'DEBRIS', priority: 4, altitude_km: 780, fuel_remaining: 0, controllable: false },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-md)' }}>
      {list.map(sat => {
        const f = (sat.fuel_remaining * 100).toFixed(0)
        return (
          <div key={sat.id} className="neo-panel" style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-heading)', fontFamily: 'var(--font-display)' }}>{sat.name}</span>
              <span className="neo-inset" style={{ fontSize: '9px', padding: '3px 10px', fontFamily: 'var(--font-mono)', fontWeight: '600', color: sat.controllable ? 'var(--status-ok)' : 'var(--status-bad)', letterSpacing: '0.06em' }}>{sat.controllable ? 'CTRL' : 'INERT'}</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
              <span>{sat.id}</span><span>P{sat.priority}</span><span style={{ color: 'var(--accent-dim)' }}>{sat.operator}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              <span>ALT {sat.altitude_km.toLocaleString()} km</span>
              <div style={{ flex: 1, height: '3px', background: 'var(--bg-surface)', borderRadius: '2px', overflow: 'hidden' }}><div style={{ width: `${f}%`, height: '100%', background: 'var(--accent-dim)', borderRadius: '2px' }} /></div>
              <span>FUEL {f}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══ Alerts View ═════════════════════════════════════════════════════

const ALERTS = [
  { sev: 'critical', text: 'SAT-001 ↔ SAT-002 collision probability 82%', time: '2m ago' },
  { sev: 'high', text: 'DEBRIS-001 entering GPS constellation altitude', time: '8m ago' },
  { sev: 'medium', text: 'Starlink fuel reserves below 40% threshold', time: '15m ago' },
  { sev: 'low', text: 'ISS orbit adjustment scheduled next pass', time: '1h ago' },
  { sev: 'medium', text: 'New debris field detected at 550 km orbit', time: '2h ago' },
]
const SEV = { critical: 'var(--status-bad)', high: 'var(--status-bad)', medium: 'var(--status-warn)', low: 'var(--status-ok)' }

function AlertsView() {
  return (
    <div className="neo-panel" style={{ padding: 'var(--space-lg)' }}>
      <div style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-secondary)', fontWeight: '600', fontFamily: 'var(--font-display)', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>ALERTS</div>
      {ALERTS.map((a, i) => (
        <div key={i} className="neo-inset" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: SEV[a.sev], flexShrink: 0, animation: a.sev === 'critical' ? 'pulse 1.5s infinite' : 'none' }} />
          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontWeight: '600', color: SEV[a.sev], letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0, background: 'var(--bg-deep)' }}>{a.sev}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-primary)', flex: 1 }}>{a.text}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{a.time}</span>
        </div>
      ))}
    </div>
  )
}

// ═══ Dashboard ═══════════════════════════════════════════════════════

function Dashboard({ onBack }) {
  const sim = useSimulation()
  const [view, setView] = useState('dashboard')
  const clock = useLiveClock()

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      <Sidebar active={view} onNav={setView} onBack={onBack} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header connected={sim.connected} status={sim.status} clock={clock} />
        <main style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          padding: view === 'mission' ? 'var(--space-md)' : 'var(--space-md)',
          minHeight: 0,
          overflow: view === 'mission' ? 'hidden' : 'auto',
        }}>
          {view === 'dashboard'   && <AnalyticsView sim={sim} />}
          {view === 'mission'     && <MissionView sim={sim} />}
          {view === 'satellites'  && <SatellitesView satellites={sim.satellites} />}
          {view === 'alerts'      && <AlertsView />}
        </main>
      </div>
    </div>
  )
}

// ═══ App ═════════════════════════════════════════════════════════════

export default function App() {
  const [page, setPage] = useState('landing')

  if (page === 'landing') return <LandingPage onEnter={() => setPage('transitioning')} />
  if (page === 'transitioning') return (
    <>
      <LandingPage onEnter={() => {}} />
      <LaunchTransition onComplete={() => setPage('dashboard')} />
    </>
  )
  return <Dashboard onBack={() => setPage('landing')} />
}
