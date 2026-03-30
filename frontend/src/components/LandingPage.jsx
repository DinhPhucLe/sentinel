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

const TECH_STACK = [
  { name: 'Python', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.9S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.03v-2.867s-.109-3.403 3.35-3.403h5.766s3.24.052 3.24-3.134V3.195S18.28 0 11.914 0zM8.708 1.846a1.052 1.052 0 110 2.104 1.052 1.052 0 010-2.104z"/><path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752h-5.814v-.826H20.1S24 18.211 24 12.031c0-6.18-3.403-5.96-3.403-5.96h-2.03v2.867s.109 3.403-3.35 3.403H9.451s-3.24-.052-3.24 3.134v5.33S5.72 24 12.086 24zm3.206-1.846a1.052 1.052 0 110-2.104 1.052 1.052 0 010 2.104z"/></svg>
  )},
  { name: 'FastAPI', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.375 0 0 5.375 0 12c0 6.627 5.375 12 12 12 6.626 0 12-5.373 12-12 0-6.625-5.374-12-12-12zm-.624 21.62v-7.528H7.19L13.203 2.38v7.528h4.029L11.376 21.62z"/></svg>
  )},
  { name: 'React', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="11.245" r="2.1"/><path d="M12 6.862c3.141 0 5.96.632 8.012 1.65.987.49 1.78 1.072 2.328 1.733.548.662.86 1.408.86 2.2 0 .793-.312 1.538-.86 2.2-.548.661-1.341 1.244-2.328 1.732C17.96 17.396 15.141 18.028 12 18.028c-3.14 0-5.96-.632-8.012-1.65-.987-.489-1.78-1.071-2.327-1.733C1.113 13.983.8 13.238.8 12.445c0-.792.313-1.538.861-2.2.547-.66 1.34-1.243 2.327-1.732C6.04 7.494 8.86 6.862 12 6.862zm0-3.19c1.575-2.69 3.348-4.472 5.042-5.072.814-.289 1.594-.324 2.29-.074.697.25 1.245.764 1.613 1.4.737 1.275.505 3.07-.426 5.054a17.14 17.14 0 01-2.156 3.154c-1.577 2.69-3.7 5.08-5.86 6.81a17.14 17.14 0 01-3.515 2.228c-1.758.832-3.486.999-4.648.325-.368-.214-.66-.503-.874-.854-.368-.637-.505-1.468-.32-2.44.178-.936.622-2 1.32-3.164C6.04 8.399 8.16 6.008 10.321 4.28A17.04 17.04 0 0112 3.672zm0 0c-1.575-2.69-3.348-4.472-5.042-5.072-.814-.289-1.594-.324-2.29-.074-.697.25-1.245.764-1.613 1.4-.737 1.275-.505 3.07.426 5.054A17.14 17.14 0 005.637 8.134c1.577 2.69 3.7 5.08 5.86 6.81a17.14 17.14 0 003.515 2.228c1.758.832 3.486.999 4.648.325.368-.214.66-.503.874-.854.368-.637.505-1.468.32-2.44-.178-.936-.622-2-1.32-3.164-1.577-2.636-3.697-5.027-5.857-6.755A17.14 17.14 0 0012 3.672z" fillRule="evenodd"/></svg>
  )},
  { name: 'Three.js', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M.38 0a.268.268 0 00-.256.332l2.894 11.716a.268.268 0 00.01.04l2.89 11.708a.268.268 0 00.447.128L23.802 7.15a.268.268 0 00-.112-.45l-5.784-1.667a.268.268 0 00-.123-.035L6.38 1.715a.268.268 0 00-.144-.04L.456.011A.268.268 0 00.38 0z"/></svg>
  )},
  { name: 'Claude AI', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-1-1 4-4-4-4 1-1 5 5-5 5z"/></svg>
  )},
  { name: 'Google ADK', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
  )},
  { name: 'WebSocket', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M5.22 12.6l-1.9 1.9A7.25 7.25 0 0013.54 4.28l-1.9 1.9a4.99 4.99 0 00-6.42 6.42zm13.56-1.2l1.9-1.9A7.25 7.25 0 0010.46 19.72l1.9-1.9a4.99 4.99 0 006.42-6.42zM8.11 16.95l-1.41-1.41 9.19-9.19 1.41 1.41-9.19 9.19z"/></svg>
  )},
  { name: 'Docker', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13.983 11.078h2.119a.186.186 0 00.186-.186V9.006a.186.186 0 00-.186-.186h-2.119a.186.186 0 00-.187.186v1.886c0 .103.084.186.187.186zm-2.954-5.43h2.118a.186.186 0 00.187-.185V3.577a.186.186 0 00-.187-.186h-2.118a.186.186 0 00-.187.186v1.886c0 .102.084.185.187.185zm0 2.716h2.118a.187.187 0 00.187-.186V6.292a.187.187 0 00-.187-.186h-2.118a.187.187 0 00-.187.186v1.886c0 .103.084.186.187.186zm-2.93 0h2.12a.186.186 0 00.186-.186V6.292a.186.186 0 00-.187-.186H8.1a.186.186 0 00-.185.186v1.886c0 .103.083.186.185.186zm-2.964 0h2.119a.186.186 0 00.185-.186V6.292a.186.186 0 00-.185-.186H5.136a.186.186 0 00-.186.186v1.886c0 .103.084.186.186.186zm5.893 2.715h2.118a.186.186 0 00.186-.186V9.006a.186.186 0 00-.186-.186h-2.118a.187.187 0 00-.187.186v1.886c0 .103.084.186.187.186zm-2.93 0h2.12a.185.185 0 00.185-.186V9.006a.185.185 0 00-.185-.186h-2.12a.185.185 0 00-.184.186v1.886c0 .103.083.186.185.186zm-2.964 0h2.119a.186.186 0 00.185-.186V9.006a.186.186 0 00-.185-.186H5.136a.186.186 0 00-.186.186v1.886c0 .103.084.186.186.186zm-2.92 0h2.12a.185.185 0 00.184-.186V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.186v1.886c0 .103.082.186.185.186zM23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z"/></svg>
  )},
  { name: 'Vite', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.805 2.658L12.39 21.373a.479.479 0 01-.856-.013L2.108 2.67a.479.479 0 01.508-.69l9.238 1.63a.479.479 0 00.163 0l9.28-1.64a.479.479 0 01.508.688z"/></svg>
  )},
  { name: 'Nginx', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L1.605 6v12L12 24l10.395-6V6L12 0zm6 16.59c0 .705-.646 1.29-1.529 1.29-.631 0-1.217-.39-1.544-.856l-4.76-7.064v6.631c0 .762-.592 1.289-1.286 1.289H8.87c-.698 0-1.29-.527-1.29-1.29V7.41c0-.705.651-1.29 1.529-1.29.635 0 1.22.39 1.547.856l4.748 7.063V7.41c0-.762.597-1.29 1.291-1.29h.014c.694 0 1.291.528 1.291 1.29v9.18z"/></svg>
  )},
]

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
    { value: 29010, label: 'OBJECTS TRACKED' },
    { value: 9776, label: 'DEBRIS PIECES' },
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
            HACKUSF 2026
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
            color: 'rgba(255,255,255,0.5)', marginBottom: '6px',
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

          {/* CTA button */}
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
                  color: 'rgba(255,255,255,0.55)',
                  letterSpacing: '0.1em', fontWeight: '500',
                  marginLeft: '8px',
                }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Pipeline (left) + Tech marquee (right, same line) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            opacity: bottomVisible ? 1 : 0,
            transition: 'all 0.6s ease 0.4s',
          }}>
            {/* Pipeline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {pipeline.map((name, i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '9px', fontWeight: '600',
                    fontFamily: 'var(--font-display)',
                    color: 'rgba(255,255,255,0.6)',
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

            {/* Spacer */}
            <div style={{ width: '40px', flexShrink: 0 }} />

            {/* Tech marquee — scrolling, fills remaining width */}
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', opacity: 0.35, filter: 'blur(0.4px)' }}>
              <div style={{
                display: 'flex', gap: '56px', alignItems: 'center',
                animation: 'marqueeScroll 14s linear infinite',
                width: 'max-content',
              }}>
                {[...TECH_STACK, ...TECH_STACK].map((tech, i) => (
                  <div key={`${tech.name}-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: '#fff', flexShrink: 0,
                  }}>
                    {tech.icon}
                    <span style={{
                      fontSize: '10px', fontFamily: 'var(--font-display)',
                      fontWeight: '500', whiteSpace: 'nowrap',
                    }}>
                      {tech.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
          0%, 100% { color: rgba(255,255,255,0.5); }
          20%, 35% { color: rgba(255,255,255,0.8); }
        }
        @keyframes marqueeScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}