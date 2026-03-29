import { useRef } from 'react'

/*
  SENTINEL — Animated SVG logo.
  Features:
    • Per-letter stagger reveal
    • Orbital ellipse arc threaded through the text
    • Satellite dot orbiting along the arc
    • Radar pulse ring on the "I" dot
    • Chromatic shimmer gradient

  Props:
    size   – font-size in px (default 15)
    animate – play entrance animation (default true)
*/

const LETTERS = ['S','E','N','T','I','N','E','L']

export default function SentinelLogo({ size = 15, animate = true }) {
  const svgRef = useRef(null)

  // Sizes derived from font-size
  const letterW = size * 0.72
  const totalW = LETTERS.length * letterW + size * 1.2 // extra space for orbit overshoot
  const h = size * 2.6
  const baseY = h * 0.62
  const orbitRx = totalW * 0.52
  const orbitRy = h * 0.32
  const orbitCx = totalW * 0.48
  const orbitCy = baseY - size * 0.22

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${totalW} ${h}`}
        width={totalW}
        height={h}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Main text gradient — white-to-cyan shimmer */}
          <linearGradient id="sentinel-text-grad" x1="0%" y1="0%" x2="100%" y2="0%"
            gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00c8f0">
              <animate attributeName="stop-color" values="#00c8f0;#5e8ec8;#a0d8f0;#4878b0;#00c8f0" dur="7s" repeatCount="indefinite" />
            </stop>
            <stop offset="30%" stopColor="#5e8ec8">
              <animate attributeName="stop-color" values="#5e8ec8;#a0d8f0;#4878b0;#00c8f0;#5e8ec8" dur="7s" repeatCount="indefinite" />
            </stop>
            <stop offset="55%" stopColor="#a0d8f0">
              <animate attributeName="stop-color" values="#a0d8f0;#4878b0;#00c8f0;#5e8ec8;#a0d8f0" dur="7s" repeatCount="indefinite" />
            </stop>
            <stop offset="80%" stopColor="#4878b0">
              <animate attributeName="stop-color" values="#4878b0;#00c8f0;#5e8ec8;#a0d8f0;#4878b0" dur="7s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#00c8f0">
              <animate attributeName="stop-color" values="#00c8f0;#5e8ec8;#a0d8f0;#4878b0;#00c8f0" dur="7s" repeatCount="indefinite" />
            </stop>
          </linearGradient>

          {/* Orbit line gradient */}
          <linearGradient id="sentinel-orbit-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(94,170,187,0)" />
            <stop offset="20%" stopColor="rgba(94,170,187,0.3)" />
            <stop offset="50%" stopColor="rgba(140,210,230,0.5)" />
            <stop offset="80%" stopColor="rgba(94,170,187,0.3)" />
            <stop offset="100%" stopColor="rgba(94,170,187,0)" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="sentinel-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Satellite dot glow */}
          <filter id="sat-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Radar pulse glow */}
          <filter id="radar-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        {/* ── Orbital ellipse arc (behind text) ── */}
        <ellipse
          cx={orbitCx} cy={orbitCy}
          rx={orbitRx} ry={orbitRy}
          fill="none"
          stroke="url(#sentinel-orbit-grad)"
          strokeWidth="0.6"
          strokeDasharray="3 5"
          opacity="0.5"
          transform={`rotate(-6 ${orbitCx} ${orbitCy})`}
        >
          {animate && (
            <animate attributeName="stroke-dashoffset" from="0" to="80" dur="20s" repeatCount="indefinite" />
          )}
        </ellipse>

        {/* ── Letters ── */}
        {LETTERS.map((letter, i) => {
          const x = i * letterW + letterW * 0.5
          const isI = letter === 'I' && i === 4
          const delay = animate ? `${i * 0.06}s` : '0s'

          return (
            <g key={i}>
              {/* Letter shadow for depth */}
              <text
                x={x} y={baseY}
                textAnchor="middle"
                style={{
                  fontSize: `${size}px`,
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  fill: 'rgba(94,170,187,0.08)',
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
                  letterSpacing: '0.12em',
                  fill: 'url(#sentinel-text-grad)',
                }}
              >
                {animate && (
                  <animate
                    attributeName="opacity"
                    from="0" to="1"
                    dur="0.5s"
                    begin={delay}
                    fill="freeze"
                  />
                )}
                {letter}
              </text>

              {/* Radar pulse rings on the "I" */}
              {isI && (
                <>
                  {/* Dot on the I */}
                  <circle
                    cx={x} cy={baseY - size * 1.15}
                    r={size * 0.06}
                    fill="#8cdcf0"
                    filter="url(#sat-glow)"
                  >
                    <animate attributeName="r" values={`${size*0.05};${size*0.08};${size*0.05}`} dur="2s" repeatCount="indefinite" />
                  </circle>
                  {/* Pulse ring 1 */}
                  <circle
                    cx={x} cy={baseY - size * 1.15}
                    r={size * 0.06}
                    fill="none"
                    stroke="#5eaabb"
                    strokeWidth="0.5"
                    filter="url(#radar-glow)"
                  >
                    <animate attributeName="r" from={`${size*0.06}`} to={`${size*0.5}`} dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.6" to="0" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                  {/* Pulse ring 2 (staggered) */}
                  <circle
                    cx={x} cy={baseY - size * 1.15}
                    r={size * 0.06}
                    fill="none"
                    stroke="#5eaabb"
                    strokeWidth="0.4"
                    filter="url(#radar-glow)"
                  >
                    <animate attributeName="r" from={`${size*0.06}`} to={`${size*0.5}`} dur="2.5s" begin="1.25s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.4" to="0" dur="2.5s" begin="1.25s" repeatCount="indefinite" />
                  </circle>
                </>
              )}
            </g>
          )
        })}

        {/* ── Orbiting satellite dot ── */}
        <g filter="url(#sat-glow)">
          <circle r={size * 0.07} fill="#5eaabb">
            <animateMotion
              dur="12s"
              repeatCount="indefinite"
              path={`M${orbitCx - orbitRx},${orbitCy} a${orbitRx},${orbitRy} -6 1,1 ${orbitRx*2},0 a${orbitRx},${orbitRy} -6 1,1 -${orbitRx*2},0`}
            />
            <animate attributeName="opacity" values="0.3;1;1;0.3" dur="12s" repeatCount="indefinite" />
          </circle>
          {/* Satellite trail */}
          <circle r={size * 0.16} fill="rgba(94,170,187,0.15)">
            <animateMotion
              dur="12s"
              repeatCount="indefinite"
              path={`M${orbitCx - orbitRx},${orbitCy} a${orbitRx},${orbitRy} -6 1,1 ${orbitRx*2},0 a${orbitRx},${orbitRy} -6 1,1 -${orbitRx*2},0`}
            />
            <animate attributeName="opacity" values="0;0.3;0.3;0" dur="12s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* ── Underline scanner ── */}
        <line
          x1="0" y1={baseY + size * 0.3}
          x2={totalW * 0.85} y2={baseY + size * 0.3}
          stroke="url(#sentinel-orbit-grad)"
          strokeWidth="0.5"
          opacity="0.4"
        />
        {/* Scanning highlight on underline */}
        <rect
          y={baseY + size * 0.3 - 0.5}
          width={size * 2} height="1"
          fill="rgba(140,210,230,0.4)"
          rx="0.5"
        >
          <animate
            attributeName="x"
            from={`-${size * 2}`}
            to={`${totalW}`}
            dur="4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="4s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>
    </div>
  )
}

/*
  SentinelMark — compact sidebar icon.
  An "S" with a mini orbital ring and orbiting dot.
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

        {/* Orbital ring */}
        <ellipse
          cx={cx} cy={cy}
          rx={r * 1.1} ry={r * 0.55}
          fill="none" stroke="rgba(94,170,187,0.25)" strokeWidth="0.6"
          transform={`rotate(-20 ${cx} ${cy})`}
          strokeDasharray="2 3"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="50" dur="10s" repeatCount="indefinite" />
        </ellipse>

        {/* "S" letter */}
        <text
          x={cx} y={cy + size * 0.13}
          textAnchor="middle"
          style={{
            fontSize: `${size * 0.48}px`,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 800,
            fill: 'url(#mark-s-grad)',
          }}
        >S</text>

        {/* Orbiting dot */}
        <circle r="1.5" fill="#5eaabb" filter="url(#mark-glow)">
          <animateMotion
            dur="6s" repeatCount="indefinite"
            path={`M${cx - r*1.1},${cy} a${r*1.1},${r*0.55} -20 1,1 ${r*2.2},0 a${r*1.1},${r*0.55} -20 1,1 -${r*2.2},0`}
          />
        </circle>
      </svg>
    </div>
  )
}
