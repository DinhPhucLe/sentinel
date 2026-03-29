import { useState } from 'react'
import { useSimulation } from './hooks/useSimulation'
import AgentLog from './components/AgentLog'
import RiskPanel from './components/RiskPanel'
import ControlPanel from './components/ControlPanel'
import OrbitCanvas from './components/OrbitCanvas'
import TriageTable from './components/TriageTable'

export default function App() {
  const {
    agentMessages, decision, status, satellites, events,
    isRunning, connected, triggerScenario, reset,
  } = useSimulation()

  const [selectedEvent, setSelectedEvent] = useState(null)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '60% 40%',
      gridTemplateRows: 'auto 1fr',
      gap: '8px',
      padding: '8px',
      height: '100vh',
      background: '#020b18',
      boxSizing: 'border-box',
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '20px' }}>
          {[
            { label: 'SATELLITES TRACKED', value: satellites.length },
            { label: 'ACTIVE CONJUNCTIONS', value: events.length },
            { label: 'PIPELINE STATUS', value: status },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e0f0ff' }}>{value}</div>
              <div style={{ fontSize: '9px', color: '#334155', letterSpacing: '0.08em' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Left — orbit canvas + agent log */}
      <div style={{
        display: 'grid',
        gridTemplateRows: '1fr 260px',
        gap: '8px',
        minHeight: 0,
      }}>
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
        <AgentLog messages={agentMessages} />
      </div>

      {/* Right — triage table + risk panel + control */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: 0,
        overflowY: 'auto',
      }}>
        <TriageTable
          events={events}
          selectedId={selectedEvent?.id}
          onSelect={ev => setSelectedEvent(prev => prev?.id === ev.id ? null : ev)}
        />

        <RiskPanel
          status={status}
          events={selectedEvent ? [selectedEvent] : events}
          decision={decision}
        />

        <ControlPanel
          isRunning={isRunning}
          connected={connected}
          onTrigger={triggerScenario}
          onReset={() => { reset(); setSelectedEvent(null) }}
          selectedEvent={selectedEvent}
        />
      </div>
    </div>
  )
}
