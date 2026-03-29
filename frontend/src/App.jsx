import { useState, useCallback } from 'react'
import { useSimulation } from './hooks/useSimulation'
import AgentLog from './components/AgentLog'
import RiskPanel from './components/RiskPanel'
import ControlPanel from './components/ControlPanel'
import OrbitCanvas from './components/OrbitCanvas'
import LandingPage from './components/LandingPage'

function HeaderStat({ label, value, delay }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '6px 14px',
      animation: `staggerIn 0.5s var(--ease-out) ${delay}ms both`,
    }}>
      <div style={{
        fontSize: '20px',
        fontWeight: '600',
        color: 'var(--text-heading)',
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '9px',
        color: 'var(--text-tertiary)',
        letterSpacing: '0.12em',
        fontFamily: 'var(--font-display)',
        fontWeight: '500',
        marginTop: '3px',
      }}>
        {label}
      </div>
    </div>
  )
}

function SatelliteCard({ sat, index }) {
  const fuelPct = (sat.fuel_remaining * 100).toFixed(0)
  return (
    <div
      className="neo-inset"
      style={{
        padding: '10px 12px',
        marginBottom: '6px',
        animation: `cascadeIn 0.3s var(--ease-out) ${index * 60}ms both`,
        transition: 'border-color 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px',
      }}>
        <span style={{
          color: 'var(--text-heading)', fontFamily: 'var(--font-display)',
          fontWeight: '600', fontSize: '12px',
        }}>
          {sat.name}
        </span>
        <span style={{
          fontSize: '9px', fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)', letterSpacing: '0.06em',
        }}>
          {sat.controllable ? 'CTRL' : 'INERT'}
        </span>
      </div>
      <div style={{
        display: 'flex', gap: '10px', fontSize: '10px',
        fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
      }}>
        <span>{sat.id}</span>
        <span>P{sat.priority}</span>
        <span>{sat.operator}</span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginTop: '6px', fontSize: '10px',
        fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
      }}>
        <span>{sat.altitude_km.toLocaleString()} km</span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            flex: 1, height: '2px', background: 'var(--bg-surface)',
            borderRadius: '1px', overflow: 'hidden',
          }}>
            <div style={{
              width: `${fuelPct}%`, height: '100%',
              background: 'var(--text-secondary)', borderRadius: '1px',
              transition: 'width 1s var(--ease-out)',
            }} />
          </div>
          <span>{fuelPct}%</span>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ onBack }) {
  const {
    agentMessages, decision, status, satellites, events,
    isRunning, connected, triggerScenario, reset,
  } = useSimulation()

  return (
    <div className="scan-line" style={{
      display: 'grid',
      gridTemplateColumns: '1fr 320px',
      gridTemplateRows: 'auto 1fr',
      gap: 'var(--space-md)',
      padding: 'var(--space-md)',
      height: '100vh',
      background: 'var(--bg-deep)',
      position: 'relative',
    }}>
      {/* Header */}
      <header className="neo-panel" style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center',
        gap: 'var(--space-xl)', padding: '10px 16px',
        animation: 'fadeInUp 0.4s var(--ease-out) both',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Left accent line */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: '2px', background: 'var(--accent-dim)',
        }} />

        {/* Back button */}
        <button onClick={onBack} style={{
          marginLeft: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '28px', height: '28px', borderRadius: '6px',
          background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)',
          color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <div>
          <span className="sentinel-logo" style={{ fontSize: '16px' }}>
            SENTINEL
          </span>
          <div style={{
            fontSize: '9px', color: 'var(--text-tertiary)',
            letterSpacing: '0.06em', fontFamily: 'var(--font-display)', marginTop: '1px',
          }}>
            AUTONOMOUS ORBITAL TRAFFIC CONTROL
          </div>
        </div>

        <div style={{ width: '1px', height: '28px', background: 'var(--border-subtle)' }} />

        {/* Connection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: connected ? 'var(--status-ok)' : 'var(--status-bad)',
            animation: connected ? 'dotPulse 2.5s ease-in-out infinite' : 'pulse 1s infinite',
          }} />
          <span style={{
            fontSize: '9px', fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)', letterSpacing: '0.06em',
          }}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Stats */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <HeaderStat label="SATELLITES" value={satellites.length} delay={100} />
          <HeaderStat label="EVENTS" value={events.length} delay={200} />
          <HeaderStat label="PIPELINE" value={status} delay={300} />
        </div>
      </header>

      {/* Main */}
      <div style={{
        display: 'grid', gridTemplateRows: '1fr 260px',
        gap: 'var(--space-md)', minHeight: 0,
      }}>
        <div className="neo-panel grid-bg" style={{
          overflow: 'hidden', position: 'relative',
          animation: 'fadeInUp 0.5s var(--ease-out) 80ms both',
        }}>
          <OrbitCanvas satellites={satellites} events={events} decision={decision} status={status} />
        </div>
        <div style={{ animation: 'fadeInUp 0.5s var(--ease-out) 160ms both' }}>
          <AgentLog messages={agentMessages} />
        </div>
      </div>

      {/* Sidebar */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        gap: 'var(--space-md)', minHeight: 0, overflowY: 'auto',
      }}>
        <div style={{ animation: 'fadeInUp 0.5s var(--ease-out) 120ms both' }}>
          <RiskPanel status={status} events={events} decision={decision} />
        </div>
        <div style={{ animation: 'fadeInUp 0.5s var(--ease-out) 200ms both' }}>
          <ControlPanel isRunning={isRunning} connected={connected} onTrigger={triggerScenario} onReset={reset} />
        </div>

        {/* Satellite Roster */}
        <div className="neo-panel" style={{
          padding: 'var(--space-lg)', flex: 1,
          animation: 'fadeInUp 0.5s var(--ease-out) 280ms both',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-secondary)',
            fontWeight: '600', fontFamily: 'var(--font-display)',
            paddingBottom: '8px', marginBottom: '10px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            SATELLITE ROSTER
            <span style={{
              float: 'right', fontFamily: 'var(--font-mono)',
              fontSize: '9px', color: 'var(--text-tertiary)', fontWeight: '400',
            }}>
              {satellites.length}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {satellites.map((sat, i) => <SatelliteCard key={sat.id} sat={sat} index={i} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('landing')
  const [transitionPhase, setTransitionPhase] = useState(null)

  const handleEnterDashboard = useCallback(() => {
    setPage('transitioning-to-dashboard')
    setTransitionPhase('warp')
    setTimeout(() => { setTransitionPhase('fade-in'); setPage('dashboard') }, 1200)
    setTimeout(() => setTransitionPhase(null), 2000)
  }, [])

  const handleBackToLanding = useCallback(() => {
    setPage('transitioning-to-landing')
    setTransitionPhase('zoom-out')
    setTimeout(() => { setTransitionPhase('fade-back'); setPage('landing') }, 800)
    setTimeout(() => setTransitionPhase(null), 1600)
  }, [])

  const showLanding = page === 'landing' || page === 'transitioning-to-dashboard'
  const showDashboard = page === 'dashboard' || page === 'transitioning-to-landing'

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-deep)' }}>
      {transitionPhase && <div className={`page-transition ${transitionPhase}`} />}
      {showLanding && (
        <div className={transitionPhase === 'warp' ? 'page-exit-warp' : transitionPhase === 'fade-back' ? 'page-enter-fade' : ''}
          style={{ position: 'absolute', inset: 0, zIndex: page === 'landing' ? 2 : 1 }}>
          <LandingPage onEnter={handleEnterDashboard} />
        </div>
      )}
      {showDashboard && (
        <div className={transitionPhase === 'fade-in' ? 'page-enter-zoom' : transitionPhase === 'zoom-out' ? 'page-exit-zoom' : ''}
          style={{ position: 'absolute', inset: 0, zIndex: page === 'dashboard' ? 2 : 1 }}>
          <Dashboard onBack={handleBackToLanding} />
        </div>
      )}
    </div>
  )
}
