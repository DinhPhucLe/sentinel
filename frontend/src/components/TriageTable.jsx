function ProbBadge({ prob }) {
  const pct = (prob * 100).toFixed(2)
  const color = prob >= 0.01 ? '#f87171' : prob >= 0.001 ? '#fb923c' : prob >= 0.0001 ? '#fbbf24' : '#34d399'
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 5px',
      background: color + '1a',
      border: `1px solid ${color}66`,
      borderRadius: '3px',
      color,
      fontWeight: 'bold',
      fontSize: '10px',
      fontFamily: 'monospace',
      whiteSpace: 'nowrap',
    }}>
      {pct}%
    </span>
  )
}

function formatTCA(hours) {
  const ms = hours * 60 * 60 * 1000
  const d = new Date(Date.now() + ms)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default function TriageTable({ events, selectedId, onSelect }) {
  const sorted = [...events].sort((a, b) => b.collision_probability - a.collision_probability)

  const thStyle = {
    textAlign: 'left',
    padding: '5px 6px',
    color: '#475569',
    fontWeight: 'normal',
    fontSize: '10px',
    letterSpacing: '0.08em',
    background: '#070f1a',
    borderBottom: '1px solid #1e3a5f',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  }

  return (
    <div style={{
      background: '#070f1a',
      border: '1px solid #1e3a5f',
      borderRadius: '6px',
      padding: '12px',
      flexShrink: 0,
      height: '230px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        fontSize: '11px', fontWeight: 'bold', color: '#38bdf8',
        letterSpacing: '0.1em', borderBottom: '1px solid #1e3a5f',
        paddingBottom: '8px', marginBottom: '8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <span>CONJUNCTION TRIAGE</span>
        <span style={{ color: '#334155', fontWeight: 'normal' }}>{events.length} ACTIVE</span>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              {['SAT 1', 'SAT 2', 'PROB', 'TCA', 'MISS KM'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(ev => {
              const sel = ev.id === selectedId
              return (
                <tr
                  key={ev.id}
                  onClick={() => onSelect(ev)}
                  style={{
                    cursor: 'pointer',
                    background: sel ? '#0d2a40' : 'transparent',
                    borderLeft: `2px solid ${sel ? '#38bdf8' : 'transparent'}`,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#0a1a2a' }}
                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '5px 6px', color: '#e0f0ff', whiteSpace: 'nowrap' }}>
                    {ev.sat_a?.name ?? '—'}
                  </td>
                  <td style={{ padding: '5px 6px', color: '#e0f0ff', whiteSpace: 'nowrap' }}>
                    {ev.sat_b?.name ?? '—'}
                  </td>
                  <td style={{ padding: '5px 6px' }}>
                    <ProbBadge prob={ev.collision_probability ?? 0} />
                  </td>
                  <td style={{ padding: '5px 6px', color: '#64748b', whiteSpace: 'nowrap', fontSize: '10px' }}>
                    {formatTCA(ev.time_to_closest_approach_hours ?? 0)}
                  </td>
                  <td style={{ padding: '5px 6px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '10px' }}>
                    {(ev.miss_distance_km ?? 0).toFixed(3)}
                  </td>
                </tr>
              )
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '16px 6px', color: '#334155', textAlign: 'center', fontSize: '11px' }}>
                  No active conjunctions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div style={{ marginTop: '6px', fontSize: '10px', color: '#38bdf8', letterSpacing: '0.06em', flexShrink: 0 }}>
          ▶ {selectedId} selected
        </div>
      )}
    </div>
  )
}
