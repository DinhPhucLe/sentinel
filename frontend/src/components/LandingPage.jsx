import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'

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

    // Stars
    const starCount = 3000
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(starCount * 3)
    const starSizes = new Float32Array(starCount)
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 120
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 120
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 120
      starSizes[i] = Math.random() * 0.08 + 0.02
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    starGeo.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1))

    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.06,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    })
    scene.add(new THREE.Points(starGeo, starMat))

    // Earth
    const earthGeo = new THREE.SphereGeometry(2, 64, 64)
    const earthMat = new THREE.MeshBasicMaterial({ color: 0x0a2244, transparent: true, opacity: 0.9 })
    const earth = new THREE.Mesh(earthGeo, earthMat)
    earth.position.set(3, -1.5, -4)
    scene.add(earth)

    // Earth wireframe
    const wireGeo = new THREE.SphereGeometry(2.01, 32, 32)
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x1e3a5f, wireframe: true, transparent: true, opacity: 0.2 })
    const wire = new THREE.Mesh(wireGeo, wireMat)
    wire.position.copy(earth.position)
    scene.add(wire)

    // Atmosphere glow
    const atmGeo = new THREE.SphereGeometry(2.15, 32, 32)
    const atmMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.04, side: THREE.BackSide })
    const atm = new THREE.Mesh(atmGeo, atmMat)
    atm.position.copy(earth.position)
    scene.add(atm)

    // Orbit rings around Earth
    const orbitColors = [0x38bdf8, 0x34d399, 0xfbbf24]
    const orbitRadii = [2.6, 3.2, 4.0]
    const orbitTilts = [0.3, -0.15, 0.5]
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
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      const mat = new THREE.LineBasicMaterial({ color: orbitColors[i], transparent: true, opacity: 0.15 })
      scene.add(new THREE.Line(geo, mat))
    })

    // Satellite dots on orbits
    const satMeshes = orbitRadii.map((r, i) => {
      const geo = new THREE.SphereGeometry(0.04, 8, 8)
      const mat = new THREE.MeshBasicMaterial({ color: orbitColors[i] })
      const mesh = new THREE.Mesh(geo, mat)
      scene.add(mesh)

      // Glow
      const glowGeo = new THREE.SphereGeometry(0.08, 8, 8)
      const glowMat = new THREE.MeshBasicMaterial({ color: orbitColors[i], transparent: true, opacity: 0.3 })
      const glow = new THREE.Mesh(glowGeo, glowMat)
      mesh.add(glow)

      return { mesh, radius: r, tilt: orbitTilts[i], speed: 0.2 + i * 0.1, offset: i * 2.1 }
    })

    // Conjunction warning line (red dashed)
    const conjPts = [new THREE.Vector3(), new THREE.Vector3()]
    const conjGeo = new THREE.BufferGeometry().setFromPoints(conjPts)
    const conjMat = new THREE.LineDashedMaterial({ color: 0xf87171, dashSize: 0.1, gapSize: 0.06, transparent: true, opacity: 0 })
    const conjLine = new THREE.Line(conjGeo, conjMat)
    conjLine.computeLineDistances()
    scene.add(conjLine)

    const clock = new THREE.Clock()
    let animId

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      // Rotate earth slowly
      earth.rotation.y = t * 0.05
      wire.rotation.y = t * 0.05

      // Move satellites
      satMeshes.forEach((s) => {
        const a = t * s.speed + s.offset
        s.mesh.position.set(
          earth.position.x + Math.cos(a) * s.radius,
          earth.position.y + Math.sin(a) * s.radius * Math.sin(s.tilt),
          earth.position.z + Math.sin(a) * s.radius * Math.cos(s.tilt),
        )
      })

      // Pulsing conjunction line between sat 0 and sat 1
      if (satMeshes.length >= 2) {
        const posA = satMeshes[0].mesh.position
        const posB = satMeshes[1].mesh.position
        conjGeo.setFromPoints([posA, posB])
        conjLine.computeLineDistances()
        // Pulse opacity
        conjMat.opacity = (Math.sin(t * 3) * 0.5 + 0.5) * 0.5
      }

      // Slow camera drift
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

// ── Typing animation hook ───────────────────────────────────────────
function useTyping(text, speed = 40, delay = 0) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    let i = 0
    let timeout
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

// ── Animated counter ────────────────────────────────────────────────
function AnimatedNumber({ target, duration = 2000, delay = 0, prefix = '', suffix = '' }) {
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
  return <>{prefix}{value.toLocaleString()}{suffix}</>
}

// ── Main Landing Page ───────────────────────────────────────────────
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
    { value: 0, label: 'AUTOMATED SYSTEMS', suffix: '', special: true },
    { value: 5, label: 'AI AGENTS', suffix: '' },
  ]

  const features = [
    { icon: '01', title: 'DETECT', desc: 'Real-time conjunction event tracking' },
    { icon: '02', title: 'REASON', desc: 'Multi-agent risk assessment pipeline' },
    { icon: '03', title: 'NEGOTIATE', desc: 'Cross-operator maneuver negotiation' },
    { icon: '04', title: 'VALIDATE', desc: 'Autonomous governance & safety checks' },
  ]

  const agents = [
    { name: 'TRACKING', color: '#38bdf8', role: 'Event ingestion & urgency scoring' },
    { name: 'PREDICTION', color: '#a78bfa', role: 'Risk contextualization & cascade analysis' },
    { name: 'OPTIMIZATION', color: '#34d399', role: 'Maneuver simulation & trade-off analysis' },
    { name: 'NEGOTIATION', color: '#fb923c', role: 'Cross-operator decision arbitration' },
    { name: 'GOVERNANCE', color: '#f472b6', role: 'Safety validation & compliance audit' },
  ]

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#020b18',
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
        background: 'linear-gradient(135deg, rgba(2,11,24,0.95) 0%, rgba(2,11,24,0.6) 50%, rgba(2,11,24,0.85) 100%)',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', zIndex: 1,
        background: 'linear-gradient(to top, #020b18 0%, transparent 100%)',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 2,
        height: '100%',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: '#1e3a5f #020b18',
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
              background: '#34d399',
              boxShadow: '0 0 8px #34d399',
              animation: 'livePulse 2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: '11px', color: '#34d399', letterSpacing: '0.15em', fontWeight: 'bold' }}>
              SYSTEM ACTIVE
            </span>
            <span style={{ fontSize: '11px', color: '#334155', letterSpacing: '0.1em' }}>
              v1.0.0
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '10px', color: '#1e3a5f', letterSpacing: '0.1em' }}>
              STANFORD HACKATHON 2025
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
              color: '#38bdf8',
              marginBottom: '16px',
              fontWeight: 'bold',
            }}>
              ORBITAL DEFENSE SYSTEM
            </div>

            <h1 style={{
              fontSize: 'clamp(48px, 8vw, 96px)',
              fontWeight: 'bold',
              color: '#e0f0ff',
              lineHeight: 0.95,
              margin: '0 0 24px 0',
              letterSpacing: '-0.02em',
            }}>
              <span style={{ color: '#38bdf8' }}>S</span>ENTINEL
            </h1>

            <div style={{
              fontSize: 'clamp(16px, 2.5vw, 22px)',
              color: '#94a3b8',
              lineHeight: 1.4,
              minHeight: '32px',
              borderLeft: '2px solid #38bdf8',
              paddingLeft: '16px',
            }}>
              {tagline}
              <span style={{ animation: 'blink 1s step-end infinite', color: '#38bdf8' }}>|</span>
            </div>

            <div style={{
              fontSize: '14px',
              color: '#475569',
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
            background: '#1e3a5f',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '60px',
            opacity: statsVisible ? 1 : 0,
            transform: statsVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s ease',
          }}>
            {stats.map((s, i) => (
              <div key={s.label} style={{
                background: '#070f1a',
                padding: '28px 20px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '36px',
                  fontWeight: 'bold',
                  color: s.special ? '#f87171' : '#e0f0ff',
                  lineHeight: 1,
                  marginBottom: '8px',
                }}>
                  {s.special ? '0' : <AnimatedNumber target={s.value} delay={2000 + i * 300} suffix={s.suffix} />}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: s.special ? '#f87171' : '#64748b',
                  letterSpacing: '0.12em',
                  fontWeight: s.special ? 'bold' : 'normal',
                }}>
                  {s.label}
                  {s.special && (
                    <div style={{ fontSize: '9px', color: '#f8717188', marginTop: '4px' }}>
                      UNTIL NOW
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline visualization */}
          <div style={{
            marginBottom: '60px',
            opacity: featuresVisible ? 1 : 0,
            transform: featuresVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.8s ease',
          }}>
            <div style={{
              fontSize: '11px', letterSpacing: '0.2em', color: '#38bdf8',
              marginBottom: '24px', fontWeight: 'bold',
            }}>
              AGENT PIPELINE
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0',
              overflowX: 'auto',
              paddingBottom: '8px',
            }}>
              {agents.map((agent, i) => (
                <div key={agent.name} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    background: '#070f1a',
                    border: `1px solid ${agent.color}33`,
                    borderRadius: '8px',
                    padding: '16px 20px',
                    minWidth: '160px',
                    transition: 'all 0.3s',
                    cursor: 'default',
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = agent.color
                      e.currentTarget.style.boxShadow = `0 0 20px ${agent.color}22`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = `${agent.color}33`
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div style={{
                      fontSize: '12px', fontWeight: 'bold', color: agent.color,
                      letterSpacing: '0.1em', marginBottom: '6px',
                    }}>
                      {agent.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                      {agent.role}
                    </div>
                  </div>
                  {i < agents.length - 1 && (
                    <div style={{
                      color: '#1e3a5f',
                      fontSize: '18px',
                      padding: '0 8px',
                      flexShrink: 0,
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
              fontSize: '11px', letterSpacing: '0.2em', color: '#38bdf8',
              marginBottom: '24px', fontWeight: 'bold',
            }}>
              HOW IT WORKS
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
            }}>
              {features.map((f, i) => (
                <div key={f.title} style={{
                  background: '#070f1a',
                  border: '1px solid #1e3a5f22',
                  borderRadius: '8px',
                  padding: '24px 20px',
                  transition: 'all 0.3s',
                  cursor: 'default',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#38bdf844'
                    e.currentTarget.style.transform = 'translateY(-4px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#1e3a5f22'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={{
                    fontSize: '32px', fontWeight: 'bold', color: '#1e3a5f',
                    marginBottom: '12px', lineHeight: 1,
                  }}>
                    {f.icon}
                  </div>
                  <div style={{
                    fontSize: '13px', fontWeight: 'bold', color: '#e0f0ff',
                    letterSpacing: '0.1em', marginBottom: '8px',
                  }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
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
              fontSize: '11px', letterSpacing: '0.2em', color: '#38bdf8',
              marginBottom: '16px', fontWeight: 'bold',
            }}>
              TECH STACK
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                'Google ADK', 'Gemini 2.0', 'FastAPI', 'WebSockets',
                'React', 'Three.js', 'Vite', 'Python 3.11',
              ].map(tech => (
                <span key={tech} style={{
                  padding: '6px 14px',
                  background: '#0d1e30',
                  border: '1px solid #1e3a5f44',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#94a3b8',
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
              style={{
                padding: '18px 60px',
                background: 'linear-gradient(135deg, #0d2d4a 0%, #1e3a5f 100%)',
                border: '1px solid #38bdf8',
                borderRadius: '6px',
                color: '#38bdf8',
                fontSize: '14px',
                fontWeight: 'bold',
                letterSpacing: '0.2em',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.3s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #1e3a5f 0%, #38bdf8 100%)'
                e.currentTarget.style.color = '#020b18'
                e.currentTarget.style.transform = 'scale(1.05)'
                e.currentTarget.style.boxShadow = '0 0 40px #38bdf844'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #0d2d4a 0%, #1e3a5f 100%)'
                e.currentTarget.style.color = '#38bdf8'
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              LAUNCH MISSION CONTROL
            </button>
            <div style={{ fontSize: '11px', color: '#334155', marginTop: '16px', letterSpacing: '0.08em' }}>
              PRESS TO ENTER THE ORBITAL TRAFFIC CONTROL CENTER
            </div>
          </div>

          {/* Footer */}
          <div style={{
            borderTop: '1px solid #1e3a5f22',
            paddingTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: buttonVisible ? 0.6 : 0,
            transition: 'opacity 0.8s ease 0.5s',
          }}>
            <div style={{ fontSize: '10px', color: '#334155', letterSpacing: '0.1em' }}>
              SENTINEL ORBITAL DEFENSE SYSTEM
            </div>
            <div style={{ fontSize: '10px', color: '#334155', letterSpacing: '0.1em' }}>
              BUILT FOR STANFORD HACKATHON
            </div>
          </div>
        </div>
      </div>

      {/* Global animations */}
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #34d399; }
          50% { opacity: 0.5; box-shadow: 0 0 16px #34d399; }
        }
        /* Scrollbar styling */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #020b18; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }
      `}</style>
    </div>
  )
}
