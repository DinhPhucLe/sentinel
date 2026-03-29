import { useSimulation } from './hooks/useSimulation'
import AgentLog from './components/AgentLog'
import RiskPanel from './components/RiskPanel'
import ControlPanel from './components/ControlPanel'
import OrbitCanvas from './components/OrbitCanvas'

export default function App() {
  const {
    agentMessages, decision, status, satellites, events,
    isRunning, connected, triggerScenario, reset,
  } = useSimulation()

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 320px',
      gridTemplateRows: 'auto 1fr',
      gap: '8px',
      padding: '8px',
      height: '100vh',
      background: '#020b18',
    }}>
      {/* Header */}
      <div style={{
        gridColumn: '1 / -1',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '8px 12px',
        background: '#040c16',
        border: '1px solid #1e3a5f',
        borderRadius: '6px',
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#38bdf8', letterSpacing: '0.1em' }}>
            AUTONOMOUS ORBITAL TRAFFIC CONTROL
          </div>
          <div style={{ fontSize: '10px', color: '#334155', letterSpacing: '0.06em' }}>
            MULTI-AGENT COLLISION AVOIDANCE SYSTEM • HACKATHON MVP
          </div>
        </div>

        {/* Live satellite count */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '20px' }}>
          {[
            { label: 'SATELLITES TRACKED', value: satellites.length },
            { label: 'ACTIVE EVENTS', value: events.length },
            { label: 'PIPELINE STATUS', value: status },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e0f0ff' }}>{value}</div>
              <div style={{ fontSize: '9px', color: '#334155', letterSpacing: '0.08em' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div style={{
        display: 'grid',
        gridTemplateRows: '1fr 280px',
        gap: '8px',
        minHeight: 0,
      }}>
        {/* Orbit canvas */}
        <div style={{
          background: '#040c16',
          border: '1px solid #1e3a5f',
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          <OrbitCanvas
            satellites={satellites}
            events={events}
            decision={decision}
            status={status}
          />
        </div>

        {/* Agent log */}
        <AgentLog messages={agentMessages} />
      </div>

      {/* Right sidebar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: 0,
        overflowY: 'auto',
      }}>
        <RiskPanel status={status} events={events} decision={decision} />
        <ControlPanel
          isRunning={isRunning}
          connected={connected}
          onTrigger={triggerScenario}
          onReset={reset}
        />

        {/* Satellite roster */}
        <div style={{
          background: '#070f1a',
          border: '1px solid #1e3a5f',
          borderRadius: '6px',
          padding: '12px',
          flex: 1,
        }}>
          <div style={{
            fontSize: '11px', letterSpacing: '0.1em', color: '#38bdf8',
            fontWeight: 'bold', borderBottom: '1px solid #1e3a5f',
            paddingBottom: '8px', marginBottom: '10px',
          }}>
            SATELLITE ROSTER
          </div>
          {satellites.map(sat => (
            <div key={sat.id} style={{
              fontSize: '11px', marginBottom: '8px',
              paddingBottom: '8px', borderBottom: '1px solid #0d1e30',
            }}>
              <div style={{ color: '#e0f0ff', fontWeight: 'bold' }}>{sat.name}</div>
              <div style={{ color: '#64748b', marginTop: '2px' }}>
                {sat.id} • P{sat.priority} • {sat.operator}
              </div>
              <div style={{ color: '#64748b' }}>
                Alt: {sat.altitude_km.toLocaleString()} km •
                Fuel: {(sat.fuel_remaining * 100).toFixed(0)}% •
                {sat.controllable ? ' ✓ ctrl' : ' ✗ inert'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
