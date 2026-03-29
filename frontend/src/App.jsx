import { useState, useEffect } from 'react'
import { useSimulation } from './hooks/useSimulation'
import AgentLog from './components/AgentLog'
import RiskPanel from './components/RiskPanel'
import ControlPanel from './components/ControlPanel'
import OrbitCanvas from './components/OrbitCanvas'
import AnalyticsView from './components/LandingPage'

/*
  Single-page app. Sidebar switches views.
  ALL colors from styles.css CSS variables.
  ALL panels use neo-panel / neo-inset classes.
*/

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

function Sidebar({ active, onNav }) {
  return (
    <div style={{
      width: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: '14px', gap: '4px', flexShrink: 0,
      background: 'var(--bg-elevated)', borderRight: '1px solid var(--border-subtle)',
    }}>
      <div className="sentinel-mark" style={{ marginBottom: '14px' }}>S</div>
      <SideIcon active={active === 'dashboard'} onClick={() => onNav('dashboard')} label="Dashboard">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </SideIcon>
      <SideIcon active={active === 'mission'} onClick={() => onNav('mission')} label="Mission Control">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </SideIcon>
      <SideIcon active={active === 'satellites'} onClick={() => onNav('satellites')} label="Satellites">
        <circle cx="12" cy="12" r="3" /><path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
      </SideIcon>
      <SideIcon active={active === 'alerts'} onClick={() => onNav('alerts')} label="Alerts">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
      </SideIcon>
    </div>
  )
}

// ═══ Header ══════════════════════════════════════════════════════════

function Header({ connected, status, clock }) {
  return (
    <header className="neo-panel" style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-lg)',
      padding: '10px 20px', margin: 'var(--space-md) var(--space-md) 0',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: 'var(--accent-dim)' }} />
      <span className="sentinel-logo" style={{ fontSize: '15px', marginLeft: '8px' }}>SENTINEL</span>
      <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? 'var(--status-ok)' : 'var(--status-bad)', animation: 'dotPulse 2.5s ease-in-out infinite' }} />
        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: connected ? 'var(--status-ok)' : 'var(--status-bad)', letterSpacing: '0.08em' }}>{connected ? 'LIVE' : 'OFFLINE'}</span>
      </div>
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{clock}</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-display)', color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>PIPELINE: {status}</span>
    </header>
  )
}

// ═══ Mission Control View ════════════════════════════════════════════

function MissionView({ sim }) {
  return (
    <div className="scan-line" style={{
      display: 'grid', gridTemplateColumns: '1fr 300px', gridTemplateRows: '1fr 240px',
      gap: 'var(--space-md)', flex: 1, minHeight: 0, position: 'relative',
    }}>
      <div className="neo-panel grid-bg" style={{ overflow: 'hidden', position: 'relative' }}>
        <OrbitCanvas satellites={sim.satellites} events={sim.events} decision={sim.decision} status={sim.status} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', overflowY: 'auto' }}>
        <RiskPanel status={sim.status} events={sim.events} decision={sim.decision} />
        <ControlPanel isRunning={sim.isRunning} connected={sim.connected} onTrigger={sim.triggerScenario} onReset={sim.reset} />
      </div>
      <AgentLog messages={sim.agentMessages} />
      <div className="neo-panel" style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-secondary)', fontWeight: '600', fontFamily: 'var(--font-display)', paddingBottom: '8px', marginBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
          SATELLITE ROSTER <span style={{ float: 'right', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-tertiary)' }}>{sim.satellites.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sim.satellites.map((sat, i) => {
            const f = (sat.fuel_remaining * 100).toFixed(0)
            return (
              <div key={sat.id} className="neo-inset" style={{ padding: '8px 10px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-display)', fontWeight: '600' }}>{sat.name}</span>
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{sat.controllable ? 'CTRL' : 'INERT'}</span>
                </div>
                <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', display: 'flex', gap: '6px' }}><span>{sat.id}</span><span>P{sat.priority}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                  <div style={{ flex: 1, height: '2px', background: 'var(--bg-surface)', borderRadius: '1px', overflow: 'hidden' }}><div style={{ width: `${f}%`, height: '100%', background: 'var(--accent-dim)', borderRadius: '1px' }} /></div>
                  <span>{f}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
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
      {list.map((sat, i) => {
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
  { sev: 'critical', text: 'SAT-001 \u2194 SAT-002 collision probability 82%', time: '2m ago' },
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

// ═══ Clock Hook ══════════════════════════════════════════════════════

function useLiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return t.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC'
}

// ═══ Root ════════════════════════════════════════════════════════════

export default function App() {
  const sim = useSimulation()
  const [view, setView] = useState('dashboard')
  const clock = useLiveClock()

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      <Sidebar active={view} onNav={setView} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header connected={sim.connected} status={sim.status} clock={clock} />
        <main style={{ flex: 1, overflow: 'auto', padding: 'var(--space-md)', minHeight: 0 }}>
          {view === 'dashboard' && <AnalyticsView sim={sim} />}
          {view === 'mission' && <MissionView sim={sim} />}
          {view === 'satellites' && <SatellitesView satellites={sim.satellites} />}
          {view === 'alerts' && <AlertsView />}
        </main>
      </div>
    </div>
  )
}
