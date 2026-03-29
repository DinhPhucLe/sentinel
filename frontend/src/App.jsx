import { useState } from 'react'
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
      padding: '8px 16px',
      animation: `staggerIn 0.6s var(--ease-out) ${delay}ms both`,
    }}>
      <div style={{
        fontSize: '22px',
        fontWeight: '700',
        color: 'var(--text-heading)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.02em',
        lineHeight: 1.2,
        fontVariantNumeric: 'tabular-nums',
        transition: 'all 0.4s var(--ease-out)',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '9px',
        color: 'var(--text-tertiary)',
        letterSpacing: '0.14em',
        fontFamily: 'var(--font-display)',
        fontWeight: '500',
        marginTop: '4px',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </div>
  )
}

function SatelliteCard({ sat, index }) {
  const fuelPct = (sat.fuel_remaining * 100).toFixed(0)
  const fuelColor = fuelPct > 60
    ? 'var(--accent-success)'
    : fuelPct > 30
      ? 'var(--accent-tertiary)'
      : 'var(--accent-danger)'

  return (
    <div
      className="neo-inset"
      style={{
        padding: '12px 14px',
        marginBottom: '8px',
        animation: `cascadeIn 0.4s var(--ease-out) ${index * 80}ms both`,
        transition: 'all 0.25s var(--ease-out)',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-accent)'
        e.currentTarget.style.transform = 'translateX(4px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)'
        e.currentTarget.style.transform = 'translateX(0)'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '6px',
      }}>
        <span style={{
          color: 'var(--text-heading)',
          fontFamily: 'var(--font-display)',
          fontWeight: '600',
          fontSize: '13px',
          letterSpacing: '0.03em',
        }}>
          {sat.name}
        </span>
        <span style={{
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          color: sat.controllable ? 'var(--accent-success)' : 'var(--accent-danger)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          background: sat.controllable ? 'rgba(0, 229, 160, 0.1)' : 'rgba(255, 59, 92, 0.1)',
          border: `1px solid ${sat.controllable ? 'rgba(0, 229, 160, 0.2)' : 'rgba(255, 59, 92, 0.2)'}`,
          fontWeight: '600',
          letterSpacing: '0.08em',
        }}>
          {sat.controllable ? 'CTRL' : 'INERT'}
        </span>
      </div>
      <div style={{
        display: 'flex',
        gap: '12px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
      }}>
        <span>{sat.id}</span>
        <span>P{sat.priority}</span>
        <span style={{ color: 'var(--accent-primary)', opacity: 0.8 }}>{sat.operator}</span>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginTop: '8px',
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
      }}>
        <span>ALT {sat.altitude_km.toLocaleString()} km</span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: fuelColor }}>FUEL</span>
          <div style={{
            flex: 1,
            height: '3px',
            background: 'var(--bg-deep)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${fuelPct}%`,
              height: '100%',
              background: fuelColor,
              borderRadius: '2px',
              transition: 'width 1s var(--ease-out)',
              boxShadow: `0 0 6px ${fuelColor}`,
            }} />
          </div>
          <span style={{ color: fuelColor, fontWeight: '600' }}>{fuelPct}%</span>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const {
    agentMessages, decision, status, satellites, events,
    isRunning, connected, triggerScenario, reset,
  } = useSimulation()

  return (
    <div className="scan-line" style={{
      display: 'grid',
      gridTemplateColumns: '1fr 340px',
      gridTemplateRows: 'auto 1fr',
      gap: 'var(--space-md)',
      padding: 'var(--space-md)',
      height: '100vh',
      background: 'var(--bg-deep)',
      position: 'relative',
      animation: 'fadeInUp 0.8s var(--ease-out) both',
    }}>

      {/* ── Header ─────────────────────────────────── */}
      <header
        className="neo-panel"
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xl)',
          padding: '12px 20px',
          animation: 'fadeInUp 0.6s var(--ease-out) both',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Accent bar */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: '3px',
          background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-secondary), var(--accent-success))',
          borderRadius: '0 2px 2px 0',
          boxShadow: '0 0 12px var(--accent-primary), 0 0 30px rgba(0, 212, 255, 0.2)',
        }} />

        <div style={{ paddingLeft: '12px' }}>
          <div style={{
            fontSize: '16px',
            fontWeight: '700',
            fontFamily: 'var(--font-display)',
            color: 'var(--accent-primary)',
            letterSpacing: '0.12em',
            animation: 'textGlow 4s ease-in-out infinite',
          }}>
            SENTINEL
          </div>
          <div style={{
            fontSize: '10px',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.08em',
            fontFamily: 'var(--font-display)',
            fontWeight: '400',
            marginTop: '2px',
          }}>
            AUTONOMOUS ORBITAL TRAFFIC CONTROL
          </div>
        </div>

        <div style={{
          width: '1px', height: '32px',
          background: 'linear-gradient(180deg, transparent, var(--border-accent), transparent)',
        }} />

        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: connected ? 'var(--accent-success)' : 'var(--accent-danger)',
            boxShadow: connected
              ? '0 0 8px var(--accent-success), 0 0 16px rgba(0, 229, 160, 0.3)'
              : '0 0 8px var(--accent-danger)',
            animation: connected ? 'dotPulse 2s ease-in-out infinite' : 'pulse 1s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: connected ? 'var(--accent-success)' : 'var(--accent-danger)',
            fontWeight: '500',
            letterSpacing: '0.08em',
          }}>
            {connected ? 'ONLINE' : 'CONNECTING'}
          </span>
        </div>

        {/* Stats */}
        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          gap: '4px',
          alignItems: 'center',
        }}>
          <HeaderStat label="Satellites" value={satellites.length} delay={100} />
          <div style={{
            width: '1px', height: '28px',
            background: 'linear-gradient(180deg, transparent, var(--border-subtle), transparent)',
          }} />
          <HeaderStat label="Events" value={events.length} delay={200} />
          <div style={{
            width: '1px', height: '28px',
            background: 'linear-gradient(180deg, transparent, var(--border-subtle), transparent)',
          }} />
          <HeaderStat label="Pipeline" value={status} delay={300} />
        </div>
      </header>

      {/* ── Main Content ───────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateRows: '1fr 280px',
        gap: 'var(--space-md)',
        minHeight: 0,
      }}>
        <div
          className="neo-panel grid-bg"
          style={{
            overflow: 'hidden',
            position: 'relative',
            animation: 'fadeInUp 0.6s var(--ease-out) 100ms both',
          }}
        >
          <OrbitCanvas
            satellites={satellites}
            events={events}
            decision={decision}
            status={status}
          />
        </div>

        <div style={{ animation: 'fadeInUp 0.6s var(--ease-out) 200ms both' }}>
          <AgentLog messages={agentMessages} />
        </div>
      </div>

      {/* ── Right Sidebar ──────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
        minHeight: 0,
        overflowY: 'auto',
        paddingRight: '2px',
      }}>
        <div style={{ animation: 'fadeInUp 0.6s var(--ease-out) 150ms both' }}>
          <RiskPanel status={status} events={events} decision={decision} />
        </div>

        <div style={{ animation: 'fadeInUp 0.6s var(--ease-out) 250ms both' }}>
          <ControlPanel
            isRunning={isRunning}
            connected={connected}
            onTrigger={triggerScenario}
            onReset={reset}
          />
        </div>

        {/* Satellite Roster */}
        <div
          className="neo-panel"
          style={{
            padding: 'var(--space-lg)',
            flex: 1,
            animation: 'fadeInUp 0.6s var(--ease-out) 350ms both',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{
            fontSize: '11px',
            letterSpacing: '0.14em',
            color: 'var(--accent-primary)',
            fontWeight: '600',
            fontFamily: 'var(--font-display)',
            paddingBottom: '10px',
            marginBottom: '12px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            SATELLITE ROSTER
            <span style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              fontWeight: '400',
            }}>
              {satellites.length} active
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {satellites.map((sat, i) => (
              <SatelliteCard key={sat.id} sat={sat} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [showDashboard, setShowDashboard] = useState(false)

  if (!showDashboard) {
    return <LandingPage onEnter={() => setShowDashboard(true)} />
  }

  return <Dashboard />
}
