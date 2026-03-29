function formatTCA(hours) {
  const ms = hours * 60 * 60 * 1000
  const d = new Date(Date.now() + ms)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function ProbBadge({ prob }) {
  const pct = (prob * 100).toFixed(2)
  const color = prob >= 0.5 ? '#f87171' : prob >= 0.2 ? '#fb923c' : '#fbbf24'
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      background: color + '22',
      border: `1px solid ${color}88`,
      borderRadius: '3px',
      color,
      fontWeight: 'bold',
      fontSize: '11px',
      fontFamily: 'monospace',
    }}>
      {pct}%
    </span>
  )
}

export default function TriageTable({ events, selectedId, onSelect }) {
  return (
    <div style={{
      background: '#070f1a',
      border: '1px solid #1e3a5f',
      borderRadius: '6px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        fontSize: '11px',
        letterSpacing: '0.1em',
        color: '#38bdf8',
        fontWeight: 'bold',
        borderBottom: '1px solid #1e3a5f',
        paddingBottom: '8px',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>CONJUNCTION TRIAGE</span>
        <span style={{ color: '#334155', fontWeight: 'normal' }}>{events.length} ACTIVE</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr>
              {['SAT 1', 'SAT 2', 'PROB', 'TCA', 'MISS KM'].map(h => (
                <th key={h} style={{
                  textAlign: 'left',
                  padding: '4px 6px',
                  color: '#475569',
                  fontWeight: 'normal',
                  letterSpacing: '0.08em',
                  borderBottom: '1px solid #1e3a5f',
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map(ev => {
              const selected = ev.id === selectedId
              return (
                <tr
                  key={ev.id}
                  onClick={() => onSelect(ev)}
                  style={{
                    cursor: 'pointer',
                    background: selected ? '#0d2a40' : 'transparent',
                    borderLeft: selected ? '2px solid #38bdf8' : '2px solid transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#0a1a2a' }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '6px 6px', color: '#e0f0ff', whiteSpace: 'nowrap' }}>
                    {ev.sat_a?.name ?? '—'}
                  </td>
                  <td style={{ padding: '6px 6px', color: '#e0f0ff', whiteSpace: 'nowrap' }}>
                    {ev.sat_b?.name ?? '—'}
                  </td>
                  <td style={{ padding: '6px 6px' }}>
                    <ProbBadge prob={ev.collision_probability ?? 0} />
                  </td>
                  <td style={{ padding: '6px 6px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {formatTCA(ev.time_to_closest_approach_hours ?? 0)}
                  </td>
                  <td style={{ padding: '6px 6px', color: '#94a3b8', fontFamily: 'monospace' }}>
                    {(ev.miss_distance_km ?? 0).toFixed(3)}
                  </td>
                </tr>
              )
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '16px 6px', color: '#334155', textAlign: 'center' }}>
                  No active conjunctions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div style={{ marginTop: '8px', fontSize: '10px', color: '#38bdf8', letterSpacing: '0.06em' }}>
          ▶ {selectedId} selected — ready to analyze
        </div>
      )}
    </div>
  )
}
