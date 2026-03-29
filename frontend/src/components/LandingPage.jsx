import { useEffect, useState } from 'react'

function useTyping(text, speed = 40, delay = 0) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    let i = 0
    const startTimeout = setTimeout(() => {
      const interval = setInterval(() => {
        i++
        setDisplayed(text.slice(0, i))
        if (i >= text.length) clearInterval(interval)
      }, speed)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(startTimeout)
  }, [text, speed, delay])
  return displayed
}

function AnimatedNumber({ target, duration = 2000, delay = 0, suffix = '' }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now()
      const step = (now) => {
        const progress = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(Math.floor(eased * target))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, delay)
    return () => clearTimeout(timeout)
  }, [target, duration, delay])
  return <>{value.toLocaleString()}{suffix}</>
}

export default function LandingPage({ onEnter }) {
  const [visible, setVisible] = useState(false)
  const [bottomVisible, setBottomVisible] = useState(false)
  const tagline = useTyping('Autonomous Multi-Agent Collision Avoidance', 35, 600)
  const subtitle = useTyping('5 AI agents. Real-time negotiation. Zero human delay.', 30, 2200)

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
    setTimeout(() => setBottomVisible(true), 1600)
  }, [])

  const stats = [
    { value: 65000, label: 'OBJECTS IN ORBIT', suffix: '+' },
    { value: 12000, label: 'NEAR-MISSES / YEAR', suffix: '+' },
    { value: 0, label: 'AUTOMATED SYSTEMS', special: true },
    { value: 5, label: 'AI AGENTS' },
  ]

  const pipeline = ['TRACKING', 'PREDICTION', 'OPTIMIZATION', 'NEGOTIATION', 'GOVERNANCE']

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Video Background */}
      <video
        autoPlay muted loop playsInline
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', zIndex: 0,
        }}
      >
        <source src="/landing page.mp4" type="video/mp4" />
      </video>

      {/* Overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(135deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.65) 100%)',
      }} />

      {/* All content — single viewport, no scroll */}
      <div style={{
        position: 'relative', zIndex: 2,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 48px 28px',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
      }}>

        {/* ── Top bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'all 0.6s ease',
        }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: 'var(--status-ok)',
            animation: 'dotPulse 2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: '9px', color: 'var(--text-secondary)',
            letterSpacing: '0.14em', fontWeight: '600',
            fontFamily: 'var(--font-display)',
          }}>
            SYSTEM ACTIVE
          </span>
          <span style={{
            fontSize: '9px', color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
          }}>
            v1.0.0
          </span>
          <div style={{ flex: 1 }} />
          <span style={{
            fontSize: '9px', color: 'var(--text-tertiary)',
            letterSpacing: '0.1em', fontFamily: 'var(--font-display)',
          }}>
            HACKUSF 2025
          </span>
        </div>

        {/* ── Hero (center area) ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          maxWidth: '700px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s ease 0.2s',
        }}>
          <div style={{
            fontSize: '10px', letterSpacing: '0.3em',
            color: 'var(--text-tertiary)', marginBottom: '12px',
            fontWeight: '600', fontFamily: 'var(--font-display)',
          }}>
            ORBITAL DEFENSE SYSTEM
          </div>

          <h1 style={{
            fontSize: 'clamp(52px, 7vw, 88px)',
            fontWeight: '700', fontFamily: 'var(--font-display)',
            color: '#fff', lineHeight: 0.95,
            margin: '0 0 20px 0', letterSpacing: '-0.02em',
          }}>
            SENTINEL
          </h1>

          <div style={{
            fontSize: 'clamp(15px, 2vw, 20px)',
            fontFamily: 'var(--font-body)',
            color: 'var(--text-secondary)', lineHeight: 1.4,
            minHeight: '28px',
            borderLeft: '2px solid var(--text-tertiary)',
            paddingLeft: '14px',
          }}>
            {tagline}
            <span style={{ animation: 'pulse 1s step-end infinite', color: 'var(--text-secondary)' }}>|</span>
          </div>

          <div style={{
            fontSize: '13px', fontFamily: 'var(--font-body)',
            color: 'var(--text-tertiary)', marginTop: '8px',
            minHeight: '18px', paddingLeft: '16px',
          }}>
            {subtitle}
          </div>

          {/* CTA button right under the tagline */}
          <div style={{
            marginTop: '28px',
            opacity: bottomVisible ? 1 : 0,
            transform: bottomVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'all 0.6s ease',
          }}>
            <button
              onClick={onEnter}
              className="neo-btn primary"
              style={{
                display: 'inline-block', width: 'auto',
                padding: '14px 48px',
                fontSize: '13px', fontWeight: '600',
                letterSpacing: '0.18em',
              }}
            >
              LAUNCH MISSION CONTROL
            </button>
          </div>
        </div>

        {/* ── Bottom section: stats + pipeline ── */}
        <div style={{
          opacity: bottomVisible ? 1 : 0,
          transform: bottomVisible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.8s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {/* Stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1px', background: 'rgba(255,255,255,0.04)',
            borderRadius: 'var(--radius-sm)', overflow: 'hidden',
          }}>
            {stats.map((s, i) => (
              <div key={s.label} style={{
                background: 'rgba(8,12,20,0.75)',
                backdropFilter: 'blur(6px)',
                padding: '16px 14px', textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '28px', fontWeight: '700',
                  fontFamily: 'var(--font-mono)',
                  color: s.special ? 'var(--status-bad)' : '#fff',
                  lineHeight: 1, marginBottom: '4px',
                }}>
                  {s.special ? '0' : <AnimatedNumber target={s.value} delay={1800 + i * 200} suffix={s.suffix || ''} />}
                </div>
                <div style={{
                  fontSize: '9px', fontFamily: 'var(--font-display)',
                  color: s.special ? 'var(--status-bad)' : 'var(--text-tertiary)',
                  letterSpacing: '0.1em', fontWeight: s.special ? '600' : '400',
                }}>
                  {s.label}
                  {s.special && <span style={{ opacity: 0.5, marginLeft: '6px' }}>UNTIL NOW</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline row + footer */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            {/* Pipeline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {pipeline.map((name, i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{
                    padding: '4px 10px',
                    fontSize: '9px', fontWeight: '600',
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.08em',
                    background: 'rgba(8,12,20,0.6)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                  }}>
                    {name}
                  </span>
                  {i < pipeline.length - 1 && (
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', opacity: 0.3 }}>→</span>
                  )}
                </div>
              ))}
            </div>

            {/* Tech tags */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {['Google ADK', 'Gemini 2.0', 'FastAPI', 'React', 'Three.js'].map(t => (
                <span key={t} style={{
                  padding: '3px 8px', fontSize: '8px',
                  fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
                  letterSpacing: '0.04em',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '3px',
                }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}