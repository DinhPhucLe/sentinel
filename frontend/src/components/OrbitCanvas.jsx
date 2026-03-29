import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'

const EARTH_RADIUS = 2.5  // scene units
const AU = EARTH_RADIUS   // alias for readability

// Map altitude_km to scene radius (log scale for visual separation)
function altToRadius(alt) {
  if (alt > 10000) return EARTH_RADIUS + 3.0   // GPS orbit
  if (alt > 1000)  return EARTH_RADIUS + 1.8   // MEO
  if (alt > 350)   return EARTH_RADIUS + 0.8   // LEO
  return EARTH_RADIUS + 0.5
}

// Colors per operator
const SAT_COLORS = {
  GPS:      0x38bdf8,  // blue
  STARLINK: 0x34d399,  // green
  ISS:      0xfbbf24,  // amber
  DEBRIS:   0x94a3b8,  // gray
  UNKNOWN:  0x64748b,
}

function makeOrbitLine(radius, tilt = 0, color = 0x1e3a5f) {
  const points = []
  for (let i = 0; i <= 128; i++) {
    const angle = (i / 128) * Math.PI * 2
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * Math.sin(tilt),
      Math.sin(angle) * radius * Math.cos(tilt),
    ))
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineBasicMaterial({ color, opacity: 0.25, transparent: true })
  return new THREE.Line(geo, mat)
}

function makeSatellite(color) {
  const geo = new THREE.SphereGeometry(0.06, 8, 8)
  const mat = new THREE.MeshBasicMaterial({ color })
  const mesh = new THREE.Mesh(geo, mat)

  // Glow ring
  const ringGeo = new THREE.RingGeometry(0.09, 0.12, 16)
  const ringMat = new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, opacity: 0.4, transparent: true,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  mesh.add(ring)

  return mesh
}

function makeConjunctionLine(posA, posB) {
  const points = [
    new THREE.Vector3(...posA),
    new THREE.Vector3(...posB),
  ]
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineDashedMaterial({
    color: 0xf87171, dashSize: 0.15, gapSize: 0.08, opacity: 0.7, transparent: true,
  })
  const line = new THREE.Line(geo, mat)
  line.computeLineDistances()
  return line
}

export default function OrbitCanvas({ satellites, events, decision, status }) {
  const mountRef = useRef(null)
  const stateRef = useRef({
    renderer: null, scene: null, camera: null, animId: null,
    sats: {}, conjLine: null, clock: new THREE.Clock(),
    avoidProgress: 0, avoiding: false,
  })

  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const s = stateRef.current

    // Renderer
    s.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    s.renderer.setPixelRatio(window.devicePixelRatio)
    s.renderer.setSize(el.clientWidth, el.clientHeight)
    el.appendChild(s.renderer.domElement)

    // Scene
    s.scene = new THREE.Scene()

    // Camera
    s.camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 100)
    s.camera.position.set(0, 6, 10)
    s.camera.lookAt(0, 0, 0)

    // Stars
    const starGeo = new THREE.BufferGeometry()
    const starVerts = []
    for (let i = 0; i < 1500; i++) {
      starVerts.push((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80)
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3))
    s.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, opacity: 0.6, transparent: true })))

    // Earth
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32)
    const earthMat = new THREE.MeshBasicMaterial({ color: 0x0a2244, wireframe: false })
    const earth = new THREE.Mesh(earthGeo, earthMat)
    s.scene.add(earth)

    // Earth grid lines
    const earthWire = new THREE.Mesh(earthGeo, new THREE.MeshBasicMaterial({ color: 0x1e3a5f, wireframe: true, opacity: 0.15, transparent: true }))
    s.scene.add(earthWire)

    // Atmosphere glow
    const atmGeo = new THREE.SphereGeometry(EARTH_RADIUS + 0.15, 32, 32)
    const atmMat = new THREE.MeshBasicMaterial({ color: 0x1e88e5, opacity: 0.06, transparent: true, side: THREE.FrontSide })
    s.scene.add(new THREE.Mesh(atmGeo, atmMat))

    // Resize handler
    const onResize = () => {
      s.renderer.setSize(el.clientWidth, el.clientHeight)
      s.camera.aspect = el.clientWidth / el.clientHeight
      s.camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    // Animate
    s.animId = requestAnimationFrame(function loop() {
      s.animId = requestAnimationFrame(loop)
      const t = s.clock.getElapsedTime()

      // Rotate camera slowly
      s.camera.position.x = Math.sin(t * 0.08) * 10
      s.camera.position.z = Math.cos(t * 0.08) * 10
      s.camera.lookAt(0, 0, 0)

      // Animate satellites
      Object.entries(s.sats).forEach(([id, obj]) => {
        if (!obj) return
        const { mesh, orbitRadius, speed, tilt, angleOffset, isAvoiding, avoidOrbitRadius } = obj

        let angle = t * speed + angleOffset
        let r = orbitRadius

        // Avoidance animation for SAT-002 after decision
        if (isAvoiding && s.avoiding) {
          s.avoidProgress = Math.min(s.avoidProgress + 0.004, 1)
          const ease = 1 - Math.pow(1 - s.avoidProgress, 3)
          r = orbitRadius + (avoidOrbitRadius - orbitRadius) * ease
          obj.currentRadius = r
        }

        mesh.position.set(
          Math.cos(angle) * r,
          Math.sin(angle) * r * Math.sin(tilt),
          Math.sin(angle) * r * Math.cos(tilt),
        )
      })

      // Update conjunction line
      if (s.conjLine && s.sats['SAT-001'] && s.sats['SAT-002']) {
        const posA = s.sats['SAT-001'].mesh.position
        const posB = s.sats['SAT-002'].mesh.position
        const pts = [posA, posB]
        s.conjLine.geometry.setFromPoints(pts)
        s.conjLine.computeLineDistances()

        // Fade out line after avoidance
        if (s.avoiding && s.avoidProgress > 0.5) {
          s.conjLine.material.opacity = Math.max(0, 0.7 * (1 - (s.avoidProgress - 0.5) * 2))
        }
      }

      s.renderer.render(s.scene, s.camera)
    })

    return () => {
      cancelAnimationFrame(s.animId)
      window.removeEventListener('resize', onResize)
      s.renderer.dispose()
      el.removeChild(s.renderer.domElement)
    }
  }, [])

  // Populate satellites when data arrives
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene || !satellites?.length) return

    // Remove old satellite meshes
    Object.values(s.sats).forEach(obj => obj && s.scene.remove(obj.mesh))
    s.sats = {}

    const orbitTilts = {
      'SAT-001': 0.2,
      'SAT-002': 0.35,
      'SAT-003': -0.15,
      'DEBRIS-001': 0.5,
    }

    satellites.forEach((sat, i) => {
      const color = SAT_COLORS[sat.operator] || SAT_COLORS.UNKNOWN
      const radius = altToRadius(sat.altitude_km)
      const tilt = orbitTilts[sat.id] ?? (i * 0.2)

      // Orbit ring
      const ring = makeOrbitLine(radius, tilt, color)
      s.scene.add(ring)

      // Satellite mesh
      const mesh = makeSatellite(color)
      s.scene.add(mesh)

      // Label (canvas texture)
      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.font = '22px monospace'
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0')
      ctx.fillText(sat.name || sat.id, 8, 40)
      const tex = new THREE.CanvasTexture(canvas)
      const labelGeo = new THREE.PlaneGeometry(1.2, 0.3)
      const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
      const label = new THREE.Mesh(labelGeo, labelMat)
      label.position.set(0, 0.25, 0)
      mesh.add(label)

      s.sats[sat.id] = {
        mesh,
        orbitRadius: radius,
        avoidOrbitRadius: radius + 0.6,  // shift after avoidance
        speed: 0.3 / (radius / EARTH_RADIUS),  // faster = lower orbit
        tilt,
        angleOffset: i * (Math.PI / 2),
        isAvoiding: sat.id === 'SAT-002',
        currentRadius: radius,
      }
    })

    // SAT-001 and SAT-002 start on converging paths
    if (s.sats['SAT-001']) s.sats['SAT-001'].angleOffset = 0
    if (s.sats['SAT-002']) s.sats['SAT-002'].angleOffset = 0.1  // close approach

  }, [satellites])

  // Add conjunction line when events load
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return

    if (s.conjLine) { s.scene.remove(s.conjLine); s.conjLine = null }

    if (events?.length && s.sats['SAT-001'] && s.sats['SAT-002']) {
      const posA = s.sats['SAT-001'].mesh.position
      const posB = s.sats['SAT-002'].mesh.position
      s.conjLine = makeConjunctionLine(posA.toArray(), posB.toArray())
      s.scene.add(s.conjLine)
    }
  }, [events, satellites])

  // Trigger avoidance animation when decision is made
  useEffect(() => {
    const s = stateRef.current
    if (status === 'AVOIDED' && decision) {
      s.avoiding = true
      s.avoidProgress = 0
    }
    if (status === 'MONITORING') {
      s.avoiding = false
      s.avoidProgress = 0
    }
  }, [status, decision])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300 }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Overlay labels */}
      <div style={{
        position: 'absolute', top: 10, left: 12,
        fontSize: '10px', color: '#334155', letterSpacing: '0.1em',
      }}>
        ORBITAL VISUALIZATION
      </div>

      {status === 'AVOIDED' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#0a2a1a',
          border: '1px solid #34d399',
          borderRadius: '6px',
          padding: '10px 20px',
          color: '#34d399',
          fontSize: '14px',
          fontWeight: 'bold',
          letterSpacing: '0.1em',
          animation: 'fadeInOut 4s ease forwards',
          pointerEvents: 'none',
        }}>
          COLLISION AVOIDED
        </div>
      )}

      <style>{`
        @keyframes fadeInOut {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
