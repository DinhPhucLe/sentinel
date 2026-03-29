import { useRef } from 'react'

const LETTERS = ['S','E','N','T','I','N','E','L']

export default function SentinelLogo({ size = 15, animate = true }) {
  const svgRef = useRef(null)

  const letterW = size * 0.75
  const totalW = LETTERS.length * letterW + size * 2
  const h = size * 3
  const baseY = h * 0.58
  const orbitRx = totalW * 0.50
  const orbitRy = h * 0.30
  const orbitCx = totalW * 0.48
  const orbitCy = baseY - size * 0.15

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <svg
        ref={svgRef}
        viewBox={`-${size} 0 ${totalW + size * 2} ${h}`}
        width={totalW + size}
        height={h}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Cold color flowing gradient — cyan / steel / ice / deep blue */}
          <linearGradient id="stl-text" x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00d4ff">
              <animate attributeName="stop-color" values="#00d4ff;#4a8ec8;#a0e0f8;#3060a0;#00d4ff" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="30%" stopColor="#4a8ec8">
              <animate attributeName="stop-color" values="#4a8ec8;#a0e0f8;#3060a0;#00d4ff;#4a8ec8" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="55%" stopColor="#a0e0f8">
              <animate attributeName="stop-color" values="#a0e0f8;#3060a0;#00d4ff;#4a8ec8;#a0e0f8" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="80%" stopColor="#3060a0">
              <animate attributeName="stop-color" values="#3060a0;#00d4ff;#4a8ec8;#a0e0f8;#3060a0" dur="6s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#00d4ff">
              <animate attributeName="stop-color" values="#00d4ff;#4a8ec8;#a0e0f8;#3060a0;#00d4ff" dur="6s" repeatCount="indefinite" />
            </stop>
          </linearGradient>

          {/* Text glow filter */}
          <filter id="stl-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="b2" />
            <feMerge>
              <feMergeNode in="b1" />
              <feMergeNode in="b2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Orbit gradient */}
          <linearGradient id="stl-orbit" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,200,240,0)" />
            <stop offset="30%" stopColor="rgba(0,200,240,0.3)" />
            <stop offset="50%" stopColor="rgba(120,210,240,0.5)" />
            <stop offset="70%" stopColor="rgba(0,200,240,0.3)" />
            <stop offset="100%" stopColor="rgba(0,200,240,0)" />
          </linearGradient>

          {/* Satellite glow */}
          <filter id="stl-sat" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Radar pulse glow */}
          <filter id="stl-radar" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>

          {/* Subtle ambient glow behind text */}
          <radialGradient id="stl-ambient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,180,220,0.12)">
              <animate attributeName="stop-color" values="rgba(0,180,220,0.12);rgba(0,180,220,0.06);rgba(0,180,220,0.12)" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="rgba(0,180,220,0)" />
          </radialGradient>
        </defs>

        {/* ── Ambient glow behind text ── */}
        <ellipse cx={orbitCx} cy={baseY - size * 0.2} rx={totalW * 0.4} ry={h * 0.35}
          fill="url(#stl-ambient)" />

        {/* ── Orbital ellipse (behind text) ── */}
        <ellipse
          cx={orbitCx} cy={orbitCy}
          rx={orbitRx} ry={orbitRy}
          fill="none" stroke="url(#stl-orbit)"
          strokeWidth="0.7" strokeDasharray="4 4"
          opacity="0.6"
          transform={`rotate(-8 ${orbitCx} ${orbitCy})`}
        >
          <animate attributeName="stroke-dashoffset" from="0" to="80" dur="15s" repeatCount="indefinite" />
        </ellipse>

        {/* Second orbit ring (wider, fainter) */}
        <ellipse
          cx={orbitCx} cy={orbitCy + 2}
          rx={orbitRx * 1.12} ry={orbitRy * 1.2}
          fill="none" stroke="rgba(0,180,220,0.08)"
          strokeWidth="0.4" strokeDasharray="2 6"
          transform={`rotate(4 ${orbitCx} ${orbitCy})`}
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-60" dur="25s" repeatCount="indefinite" />
        </ellipse>

        {/* ── Glowing letters ── */}
        {LETTERS.map((letter, i) => {
          const x = i * letterW + letterW * 0.5
          const isI = letter === 'I' && i === 4
          const delay = animate ? `${i * 0.07}s` : '0s'

          return (
            <g key={i}>
              {/* Glow layer */}
              <text
                x={x} y={baseY}
                textAnchor="middle"
                filter="url(#stl-glow)"
                style={{
                  fontSize: `${size}px`,
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  fill: 'url(#stl-text)',
                  opacity: 0.5,
                }}
              >
                {letter}
              </text>

              {/* Main letter */}
              <text
                x={x} y={baseY}
                textAnchor="middle"
                style={{
                  fontSize: `${size}px`,
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  fill: 'url(#stl-text)',
                }}
              >
                {animate && (
                  <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin={delay} fill="freeze" />
                )}
                {letter}
              </text>

              {/* ── Radar pulse on the "I" ── */}
              {isI && (
                <>
                  {/* Glowing dot */}
                  <circle cx={x} cy={baseY - size * 1.18} r={size * 0.07} fill="#00d4ff" filter="url(#stl-sat)">
                    <animate attributeName="r" values={`${size*0.05};${size*0.09};${size*0.05}`} dur="2s" repeatCount="indefinite" />
                  </circle>
                  {/* Pulse ring 1 */}
                  <circle cx={x} cy={baseY - size * 1.18} r={size * 0.06}
                    fill="none" stroke="#00b8d4" strokeWidth="0.5" filter="url(#stl-radar)">
                    <animate attributeName="r" from={`${size*0.06}`} to={`${size*0.6}`} dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.7" to="0" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                  {/* Pulse ring 2 */}
                  <circle cx={x} cy={baseY - size * 1.18} r={size * 0.06}
                    fill="none" stroke="#0090a8" strokeWidth="0.4" filter="url(#stl-radar)">
                    <animate attributeName="r" from={`${size*0.06}`} to={`${size*0.6}`} dur="2.5s" begin="1.25s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="2.5s" begin="1.25s" repeatCount="indefinite" />
                  </circle>
                </>
              )}
            </g>
          )
        })}

        {/* ── Orbiting satellite dot ── */}
        <g filter="url(#stl-sat)">
          <circle r={size * 0.08} fill="#00d4ff">
            <animateMotion dur="10s" repeatCount="indefinite"
              path={`M${orbitCx - orbitRx},${orbitCy} a${orbitRx},${orbitRy} -8 1,1 ${orbitRx*2},0 a${orbitRx},${orbitRy} -8 1,1 -${orbitRx*2},0`}
            />
            <animate attributeName="opacity" values="0.2;1;1;0.2" dur="10s" repeatCount="indefinite" />
          </circle>
          {/* Trail glow */}
          <circle r={size * 0.2} fill="rgba(0,200,240,0.12)">
            <animateMotion dur="10s" repeatCount="indefinite"
              path={`M${orbitCx - orbitRx},${orbitCy} a${orbitRx},${orbitRy} -8 1,1 ${orbitRx*2},0 a${orbitRx},${orbitRy} -8 1,1 -${orbitRx*2},0`}
            />
            <animate attributeName="opacity" values="0;0.4;0.4;0" dur="10s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* ── Floating micro-particles ── */}
        {[
          { x: totalW * 0.15, y: h * 0.25, d: 7, r: 0.8 },
          { x: totalW * 0.75, y: h * 0.20, d: 9, r: 0.6 },
          { x: totalW * 0.55, y: h * 0.80, d: 11, r: 0.7 },
          { x: totalW * 0.90, y: h * 0.45, d: 8, r: 0.5 },
          { x: totalW * 0.05, y: h * 0.65, d: 13, r: 0.5 },
        ].map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="rgba(0,200,240,0.3)">
            <animate attributeName="cy" values={`${p.y};${p.y - 4};${p.y}`} dur={`${p.d}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.15;0.45;0.15" dur={`${p.d}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
    </div>
  )
}

/*
  SentinelMark — compact sidebar icon.
*/
export function SentinelMark({ size = 32 }) {
  const r = size * 0.35
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="sentinel-mark" style={{
      width: size, height: size,
      borderRadius: size * 0.3,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', cursor: 'pointer',
      background: 'linear-gradient(135deg, #1a2640 0%, #0e1a2e 50%, #1a3050 100%)',
      border: '1px solid rgba(94, 170, 187, 0.2)',
      boxShadow: '0 0 12px rgba(94, 170, 187, 0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      transition: 'all 0.3s ease',
    }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="mark-s-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d0e8f0" />
            <stop offset="100%" stopColor="#78b8cc" />
          </linearGradient>
          <filter id="mark-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <ellipse cx={cx} cy={cy} rx={r * 1.1} ry={r * 0.55}
          fill="none" stroke="rgba(94,170,187,0.25)" strokeWidth="0.6"
          transform={`rotate(-20 ${cx} ${cy})`} strokeDasharray="2 3">
          <animate attributeName="stroke-dashoffset" from="0" to="50" dur="10s" repeatCount="indefinite" />
        </ellipse>

        <text x={cx} y={cy + size * 0.13} textAnchor="middle"
          style={{ fontSize: `${size * 0.48}px`, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fill: 'url(#mark-s-grad)' }}>
          S
        </text>

        <circle r="1.5" fill="#5eaabb" filter="url(#mark-glow)">
          <animateMotion dur="6s" repeatCount="indefinite"
            path={`M${cx - r*1.1},${cy} a${r*1.1},${r*0.55} -20 1,1 ${r*2.2},0 a${r*1.1},${r*0.55} -20 1,1 -${r*2.2},0`}
          />
        </circle>
      </svg>
    </div>
  )
}
