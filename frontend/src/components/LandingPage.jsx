import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { createEarth } from '../utils/createEarth'

// ── Animated star field background ──────────────────────────────────
function StarField({ canvasRef }) {
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(el.clientWidth, el.clientHeight)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 200)
    camera.position.set(0, 0, 5)

    // Stars — white only
    const starCount = 3000
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 120
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 120
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 120
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.06, transparent: true, opacity: 0.7, sizeAttenuation: true,
    })))

    // Procedural 3D Earth with atmosphere, clouds, and night lights
    const earth = createEarth({ radius: 2, segments: 48 })
    earth.group.position.set(3, -1.5, -4)
    scene.add(earth.group)

    // Orbit rings — all same monochrome cyan with varying opacity
    const orbitRadii = [2.6, 3.2, 4.0]
    const orbitTilts = [0.3, -0.15, 0.5]
    const orbitOpacities = [0.12, 0.08, 0.06]
    orbitRadii.forEach((r, i) => {
      const pts = []
      for (let j = 0; j <= 128; j++) {
        const a = (j / 128) * Math.PI * 2
        pts.push(new THREE.Vector3(
          earth.position.x + Math.cos(a) * r,
          earth.position.y + Math.sin(a) * r * Math.sin(orbitTilts[i]),
          earth.position.z + Math.sin(a) * r * Math.cos(orbitTilts[i]),
        ))
      }
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x00C8F0, transparent: true, opacity: orbitOpacities[i] })
      ))
    })

    // Satellite dots — all same color, different brightness
    const satMeshes = orbitRadii.map((r, i) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xC0D0E0 })
      )
      scene.add(mesh)

      mesh.add(new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x00C8F0, transparent: true, opacity: 0.2 })
      ))

      return { mesh, radius: r, tilt: orbitTilts[i], speed: 0.2 + i * 0.1, offset: i * 2.1 }
    })

    // Conjunction line — muted red
    const conjGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
    const conjMat = new THREE.LineDashedMaterial({
      color: 0xE04050, dashSize: 0.1, gapSize: 0.06, transparent: true, opacity: 0,
    })
    const conjLine = new THREE.Line(conjGeo, conjMat)
    conjLine.computeLineDistances()
    scene.add(conjLine)

    const clock = new THREE.Clock()
    let animId

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      earth.rotation.y = t * 0.05
      wire.rotation.y = t * 0.05

      satMeshes.forEach((s) => {
        const a = t * s.speed + s.offset
        s.mesh.position.set(
          earth.position.x + Math.cos(a) * s.radius,
          earth.position.y + Math.sin(a) * s.radius * Math.sin(s.tilt),
          earth.position.z + Math.sin(a) * s.radius * Math.cos(s.tilt),
        )
      })

      if (satMeshes.length >= 2) {
        conjGeo.setFromPoints([satMeshes[0].mesh.position, satMeshes[1].mesh.position])
        conjLine.computeLineDistances()
        conjMat.opacity = (Math.sin(t * 3) * 0.5 + 0.5) * 0.4
      }

      camera.position.x = Math.sin(t * 0.03) * 0.5
      camera.position.y = Math.cos(t * 0.02) * 0.3
      camera.lookAt(1, -0.5, -2)

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight)
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  return null
}

// ── Typing animation ─────────────────────────────────────
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

// ── Animated counter ─────────────────────────────────────
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

// ── Main Landing Page ─────────────────────────────────────
export default function LandingPage({ onEnter }) {
  const canvasRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const [featuresVisible, setFeaturesVisible] = useState(false)
  const [buttonVisible, setButtonVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  const tagline = useTyping('Autonomous Multi-Agent Collision Avoidance', 35, 800)
  const subtitle = useTyping('5 AI agents. Real-time negotiation. Zero human delay.', 30, 2600)

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
    setTimeout(() => setStatsVisible(true), 1800)
    setTimeout(() => setFeaturesVisible(true), 3200)
    setTimeout(() => setButtonVisible(true), 4200)
  }, [])

  const handleEnter = () => {
    setExiting(true)
    setTimeout(() => onEnter(), 800)
  }

  const stats = [
    { value: 65000, label: 'OBJECTS IN ORBIT', suffix: '+' },
    { value: 12000, label: 'NEAR-MISSES / YEAR', suffix: '+' },
    { value: 0, label: 'AUTOMATED SYSTEMS', special: true },
    { value: 5, label: 'AI AGENTS' },
  ]

  const features = [
    { num: '01', title: 'DETECT', desc: 'Real-time conjunction event tracking' },
    { num: '02', title: 'REASON', desc: 'Multi-agent risk assessment pipeline' },
    { num: '03', title: 'NEGOTIATE', desc: 'Cross-operator maneuver negotiation' },
    { num: '04', title: 'VALIDATE', desc: 'Autonomous governance & safety checks' },
  ]

  const agents = [
    { name: 'TRACKING', role: 'Event ingestion & urgency scoring' },
    { name: 'PREDICTION', role: 'Risk contextualization & cascade analysis' },
    { name: 'OPTIMIZATION', role: 'Maneuver simulation & trade-off analysis' },
    { name: 'NEGOTIATION', role: 'Cross-operator decision arbitration' },
    { name: 'GOVERNANCE', role: 'Safety validation & compliance audit' },
  ]

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg-deep)',
      opacity: exiting ? 0 : 1,
      transition: 'opacity 0.8s ease',
    }}>
      {/* 3D Background */}
      <div ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <StarField canvasRef={canvasRef} />
      </div>

      {/* Gradient overlays */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(135deg, rgba(8,12,20,0.95) 0%, rgba(8,12,20,0.55) 50%, rgba(8,12,20,0.85) 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', zIndex: 1,
        background: 'linear-gradient(to top, var(--bg-deep) 0%, transparent 100%)',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 2,
        height: '100%',
        overflowY: 'auto',
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '60px 40px 80px',
        }}>
          {/* Status bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '60px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(-20px)',
            transition: 'all 0.8s ease',
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--status-success)',
              boxShadow: '0 0 8px var(--status-success)',
              animation: 'dotPulse 2s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: '11px',
              color: 'var(--status-success)',
              letterSpacing: '0.15em',
              fontWeight: '600',
              fontFamily: 'var(--font-display)',
            }}>
              SYSTEM ACTIVE
            </span>
            <span style={{
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.1em',
              fontFamily: 'var(--font-mono)',
            }}>
              v1.0.0
            </span>
            <div style={{ flex: 1 }} />
            <span style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.12em',
              fontFamily: 'var(--font-display)',
            }}>
              HACKUSF 2025
            </span>
          </div>

          {/* Hero */}
          <div style={{
            marginBottom: '60px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 1s ease 0.3s',
          }}>
            <div style={{
              fontSize: '11px',
              letterSpacing: '0.3em',
              color: 'var(--accent)',
              marginBottom: '16px',
              fontWeight: '600',
              fontFamily: 'var(--font-display)',
            }}>
              ORBITAL DEFENSE SYSTEM
            </div>

            <h1 style={{
              fontSize: 'clamp(48px, 8vw, 96px)',
              fontWeight: '700',
              fontFamily: 'var(--font-display)',
              color: 'var(--text-heading)',
              lineHeight: 0.95,
              margin: '0 0 24px 0',
              letterSpacing: '-0.02em',
            }}>
              SENTINEL
            </h1>

            <div style={{
              fontSize: 'clamp(16px, 2.5vw, 22px)',
              fontFamily: 'var(--font-body)',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              minHeight: '32px',
              borderLeft: '2px solid var(--accent)',
              paddingLeft: '16px',
            }}>
              {tagline}
              <span style={{ animation: 'pulse 1s step-end infinite', color: 'var(--accent)' }}>|</span>
            </div>

            <div style={{
              fontSize: '14px',
              fontFamily: 'var(--font-body)',
              color: 'var(--text-tertiary)',
              marginTop: '12px',
              minHeight: '20px',
              paddingLeft: '18px',
            }}>
              {subtitle}
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1px',
            background: 'var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            marginBottom: '60px',
            opacity: statsVisible ? 1 : 0,
            transform: statsVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s ease',
            boxShadow: '6px 6px 14px var(--neo-dark), -4px -4px 12px var(--neo-light)',
          }}>
            {stats.map((s, i) => (
              <div key={s.label} style={{
                background: 'var(--bg-elevated)',
                padding: '28px 20px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  fontFamily: 'var(--font-mono)',
                  color: s.special ? 'var(--status-danger)' : 'var(--text-heading)',
                  lineHeight: 1,
                  marginBottom: '8px',
                }}>
                  {s.special ? '0' : <AnimatedNumber target={s.value} delay={2000 + i * 300} suffix={s.suffix || ''} />}
                </div>
                <div style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-display)',
                  color: s.special ? 'var(--status-danger)' : 'var(--text-tertiary)',
                  letterSpacing: '0.12em',
                  fontWeight: s.special ? '600' : '400',
                }}>
                  {s.label}
                  {s.special && (
                    <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '4px' }}>
                      UNTIL NOW
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Agent Pipeline */}
          <div style={{
            marginBottom: '60px',
            opacity: featuresVisible ? 1 : 0,
            transform: featuresVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s ease',
          }}>
            <div style={{
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: 'var(--accent)',
              marginBottom: '24px',
              fontWeight: '600',
              fontFamily: 'var(--font-display)',
            }}>
              AGENT PIPELINE
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              overflowX: 'auto',
              paddingBottom: '8px',
            }}>
              {agents.map((agent, i) => (
                <div key={agent.name} style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    className="neo-panel"
                    style={{
                      padding: '16px 20px',
                      minWidth: '160px',
                      cursor: 'default',
                      animation: 'none',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--border-accent)'
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(0,200,240,0.06)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)'
                      e.currentTarget.style.boxShadow = ''
                    }}
                  >
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      fontFamily: 'var(--font-display)',
                      color: 'var(--accent)',
                      letterSpacing: '0.1em',
                      marginBottom: '6px',
                    }}>
                      {agent.name}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-body)',
                      color: 'var(--text-tertiary)',
                      lineHeight: 1.4,
                    }}>
                      {agent.role}
                    </div>
                  </div>
                  {i < agents.length - 1 && (
                    <div style={{
                      color: 'var(--text-tertiary)',
                      fontSize: '16px',
                      padding: '0 8px',
                      flexShrink: 0,
                      opacity: 0.4,
                    }}>
                      &#x2192;
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div style={{
            marginBottom: '60px',
            opacity: featuresVisible ? 1 : 0,
            transform: featuresVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s ease 0.2s',
          }}>
            <div style={{
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: 'var(--accent)',
              marginBottom: '24px',
              fontWeight: '600',
              fontFamily: 'var(--font-display)',
            }}>
              HOW IT WORKS
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
            }}>
              {features.map((f) => (
                <div
                  key={f.title}
                  className="neo-panel"
                  style={{
                    padding: '24px 20px',
                    cursor: 'default',
                    animation: 'none',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--border-accent)'
                    e.currentTarget.style.transform = 'translateY(-3px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '700',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--bg-surface-light)',
                    marginBottom: '12px',
                    lineHeight: 1,
                  }}>
                    {f.num}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text-heading)',
                    letterSpacing: '0.1em',
                    marginBottom: '8px',
                  }}>
                    {f.title}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.5,
                  }}>
                    {f.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tech stack */}
          <div style={{
            marginBottom: '60px',
            opacity: featuresVisible ? 1 : 0,
            transition: 'all 0.8s ease 0.4s',
          }}>
            <div style={{
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: 'var(--accent)',
              marginBottom: '16px',
              fontWeight: '600',
              fontFamily: 'var(--font-display)',
            }}>
              TECH STACK
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                'Google ADK', 'Gemini 2.0', 'FastAPI', 'WebSockets',
                'React', 'Three.js', 'Vite', 'Python 3.11',
              ].map(tech => (
                <span key={tech} className="neo-inset" style={{
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.06em',
                }}>
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{
            textAlign: 'center',
            padding: '40px 0',
            opacity: buttonVisible ? 1 : 0,
            transform: buttonVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s ease',
          }}>
            <button
              onClick={handleEnter}
              className="neo-button"
              style={{
                padding: '18px 60px',
                color: 'var(--accent)',
                fontSize: '14px',
                fontWeight: '600',
                letterSpacing: '0.2em',
                fontFamily: 'var(--font-display)',
                background: 'var(--accent-subtle)',
                borderColor: 'var(--border-accent)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,200,240,0.15)'
                e.currentTarget.style.boxShadow = '0 0 30px rgba(0,200,240,0.12), 6px 6px 14px var(--neo-dark)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--accent-subtle)'
                e.currentTarget.style.boxShadow = ''
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              LAUNCH MISSION CONTROL
            </button>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              marginTop: '16px',
              letterSpacing: '0.08em',
              fontFamily: 'var(--font-display)',
            }}>
              PRESS TO ENTER THE ORBITAL TRAFFIC CONTROL CENTER
            </div>
          </div>

          {/* Footer */}
          <div style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: buttonVisible ? 0.5 : 0,
            transition: 'opacity 0.8s ease 0.5s',
          }}>
            <div style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.1em',
              fontFamily: 'var(--font-display)',
            }}>
              SENTINEL ORBITAL DEFENSE SYSTEM
            </div>
            <div style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.1em',
              fontFamily: 'var(--font-display)',
            }}>
              BUILT FOR HACKUSF
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
