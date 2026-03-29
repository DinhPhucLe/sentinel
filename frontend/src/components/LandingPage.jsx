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
  const [logoReady, setLogoReady] = useState(false)
  const [bottomVisible, setBottomVisible] = useState(false)
  const tagline = useTyping('Autonomous Multi-Agent Collision Avoidance', 35, 1400)
  const subtitle = useTyping('5 AI agents. Real-time negotiation. Zero human delay.', 30, 3000)

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
    setTimeout(() => setLogoReady(true), 400)
    setTimeout(() => setBottomVisible(true), 2200)
  }, [])

  const stats = [
    { value: 65000, label: 'OBJECTS IN ORBIT', suffix: '+' },
    { value: 12000, label: 'NEAR-MISSES / YEAR', suffix: '+' },
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
            color: 'rgba(255,255,255,0.25)', marginBottom: '6px',
            fontWeight: '600', fontFamily: 'var(--font-display)',
          }}>
            ORBITAL DEFENSE SYSTEM
          </div>

          <div style={{
            position: 'relative',
            margin: '-110px 0 -30px -10px',
            display: 'inline-block',
          }}>
            {/* Glow bloom behind logo */}
            <div style={{
              position: 'absolute',
              inset: '-20%',
              background: 'radial-gradient(ellipse at center, rgba(0,180,240,0.12) 0%, transparent 70%)',
              opacity: logoReady ? 1 : 0,
              transition: 'opacity 1.5s ease 0.8s',
              pointerEvents: 'none',
              animation: logoReady ? 'logoBreathe 5s ease-in-out 1.5s infinite' : 'none',
            }} />
            <img
              src="/text_logo.png"
              alt="SENTINEL"
              style={{
                height: 'clamp(140px, 18vw, 220px)',
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
                animation: logoReady ? 'logoReveal 1.2s cubic-bezier(0.16,1,0.3,1) both' : 'none',
                filter: logoReady ? 'brightness(0.5)' : 'brightness(0)',
              }}
            />
          </div>

          <div style={{
            fontSize: 'clamp(14px, 1.8vw, 18px)',
            fontFamily: 'var(--font-body)',
            color: 'rgba(255,255,255,0.85)', lineHeight: 1.4,
            minHeight: '24px',
            paddingLeft: '2px',
            position: 'relative', zIndex: 2,
            textShadow: '0 1px 4px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.6)',
          }}>
            {tagline}
            <span style={{ animation: 'pulse 1s step-end infinite', color: 'var(--accent)' }}>|</span>
          </div>

          <div style={{
            fontSize: '12px', fontFamily: 'var(--font-body)',
            color: 'rgba(255,255,255,0.55)', marginTop: '4px',
            minHeight: '16px', paddingLeft: '2px',
            position: 'relative', zIndex: 2,
            textShadow: '0 1px 4px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.9)',
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
          {/* Stats — inline row, no cards */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: '32px',
            justifyContent: 'flex-start',
          }}>
            {stats.map((s, i) => (
              <div key={s.label} style={{
                opacity: bottomVisible ? 1 : 0,
                transform: bottomVisible ? 'translateY(0)' : 'translateY(8px)',
                transition: `all 0.6s ease ${i * 0.12}s`,
              }}>
                <span style={{
                  fontSize: '28px', fontWeight: '700',
                  fontFamily: 'var(--font-mono)',
                  color: '#fff',
                }}>
                  <AnimatedNumber target={s.value} delay={2400 + i * 250} suffix={s.suffix || ''} />
                </span>
                <span style={{
                  fontSize: '9px', fontFamily: 'var(--font-display)',
                  color: 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.1em', fontWeight: '500',
                  marginLeft: '8px',
                }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Pipeline + Tech — clean inline */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            opacity: bottomVisible ? 1 : 0,
            transition: 'all 0.6s ease 0.4s',
          }}>
            {/* Pipeline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {pipeline.map((name, i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: '600',
                    fontFamily: 'var(--font-display)',
                    color: 'rgba(255,255,255,0.35)',
                    letterSpacing: '0.08em',
                    animation: `pipelineFade 5s ease-in-out ${i * 1}s infinite`,
                  }}>
                    {name}
                  </span>
                  {i < pipeline.length - 1 && (
                    <span style={{
                      color: 'rgba(255,255,255,0.12)', fontSize: '10px',
                      animation: `pipelineFade 5s ease-in-out ${i * 1 + 0.5}s infinite`,
                    }}>→</span>
                  )}
                </div>
              ))}
            </div>

          </div>

          {/* Tech stack — scrolling marquee with logos */}
          <TechMarquee visible={bottomVisible} />
        </div>
      </div>
      {/* Logo entrance animations */}
      <style>{`
        @keyframes logoReveal {
          0%   { opacity: 0; transform: scale(0.85) translateY(12px); filter: blur(8px) brightness(2); }
          30%  { opacity: 0.4; filter: blur(3px) brightness(1.5); }
          50%  { opacity: 0.7; transform: scale(1.02) translateY(-2px); filter: blur(1px) brightness(1.2); }
          70%  { opacity: 0.9; transform: scale(0.99) translateY(1px); filter: blur(0) brightness(1.1); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0) brightness(1); }
        }
        @keyframes logoBreathe {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.05); }
        }
        @keyframes pipelineFade {
          0%, 100% { color: rgba(255,255,255,0.25); }
          20%, 35% { color: rgba(255,255,255,0.8); }
        }
      `}</style>
    </div>
  )
}