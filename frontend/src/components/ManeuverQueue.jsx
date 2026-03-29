const thStyle = {
  padding: '5px 10px', textAlign: 'left',
  color: 'var(--text-tertiary)', fontSize: '9px',
  fontWeight: '600', letterSpacing: '0.1em',
  borderBottom: '1px solid var(--border-subtle)',
  fontFamily: 'var(--font-display)',
}

const tdStyle = {
  padding: '5px 10px', color: 'var(--text-secondary)',
  verticalAlign: 'middle', fontFamily: 'var(--font-mono)',
}

function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour12: false }) }
  catch { return '--:--:--' }
}

export default function ManeuverQueue({ queue }) {
  return (
    <div className="neo-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '7px 14px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
      }}>
        <span style={{
          fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-secondary)',
          fontWeight: '600', fontFamily: 'var(--font-display)',
        }}>
          MANEUVER QUEUE
        </span>
        {queue.length > 0 && (
          <span style={{
            padding: '1px 6px', borderRadius: '3px',
            background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
            color: '#34d399', fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: '600',
          }}>
            {queue.length} PENDING
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
          {queue.length}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {queue.length === 0 ? (
          <div style={{
            padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)',
            fontSize: '11px', fontFamily: 'var(--font-body)',
          }}>
            No maneuvers queued — run simulation and push approved decisions
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>TIME</th>
                <th style={thStyle}>SATELLITES</th>
                <th style={thStyle}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item, i) => (
                <tr key={item.id} style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}>
                  <td style={{ ...tdStyle, color: 'var(--text-tertiary)', fontSize: '9px' }}>{i + 1}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-tertiary)', fontSize: '9px', whiteSpace: 'nowrap' }}>
                    {formatTime(item.timestamp)}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: '10px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {item.satA?.name ?? item.satA?.id}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--text-tertiary)' }}>
                      <span style={{ color: 'var(--border-subtle)' }}>↔</span>
                      {item.satB?.name ?? item.satB?.id}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', borderRadius: '3px',
                      background: item.decision?.validated ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
                      border: `1px solid ${item.decision?.validated ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                      color: item.decision?.validated ? '#34d399' : '#f87171',
                      fontSize: '9px', fontWeight: '600', letterSpacing: '0.06em',
                      fontFamily: 'var(--font-display)',
                    }}>
                      QUEUED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
