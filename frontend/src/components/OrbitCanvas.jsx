import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { createEarth } from '../utils/createEarth'

const EARTH_RADIUS = 2.5

function altToRadius(alt) {
  if (alt > 10000) return EARTH_RADIUS + 3.0
  if (alt > 1000)  return EARTH_RADIUS + 1.8
  if (alt > 350)   return EARTH_RADIUS + 0.8
  return EARTH_RADIUS + 0.5
}

// Monochromatic: all satellites are shades of cyan/white/gray
const SAT_COLORS = {
  GPS:      0x00C8F0,
  STARLINK: 0x90B0C0,
  ISS:      0xD0D8E0,
  DEBRIS:   0x505860,
  UNKNOWN:  0x606870,
}

function makeOrbitLine(radius, tilt = 0, color = 0x1a2535) {
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
  const mat = new THREE.LineBasicMaterial({ color, opacity: 0.2, transparent: true })
  return new THREE.Line(geo, mat)
}

function makeSatellite(color) {
  const geo = new THREE.SphereGeometry(0.06, 8, 8)
  const mat = new THREE.MeshBasicMaterial({ color })
  const mesh = new THREE.Mesh(geo, mat)

  const ringGeo = new THREE.RingGeometry(0.09, 0.12, 16)
  const ringMat = new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, opacity: 0.3, transparent: true,
  })
  mesh.add(new THREE.Mesh(ringGeo, ringMat))

  return mesh
}

function makeConjunctionLine(posA, posB) {
  const points = [new THREE.Vector3(...posA), new THREE.Vector3(...posB)]
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineDashedMaterial({
    color: 0xE04050, dashSize: 0.15, gapSize: 0.08, opacity: 0.6, transparent: true,
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

    s.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    s.renderer.setPixelRatio(window.devicePixelRatio)
    s.renderer.setSize(el.clientWidth, el.clientHeight)
    el.appendChild(s.renderer.domElement)

    s.scene = new THREE.Scene()

    s.camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 100)
    s.camera.position.set(0, 6, 10)
    s.camera.lookAt(0, 0, 0)

    // Stars — white/gray only
    const starGeo = new THREE.BufferGeometry()
    const starVerts = []
    for (let i = 0; i < 1500; i++) {
      starVerts.push(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 80,
      )
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3))
    s.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.04, opacity: 0.5, transparent: true,
    })))

    // Procedural 3D Earth with atmosphere, clouds, and night lights
    const earth = createEarth({ radius: EARTH_RADIUS, segments: 64 })
    s.scene.add(earth.group)
    s.earthUpdate = earth.update

    const onResize = () => {
      s.renderer.setSize(el.clientWidth, el.clientHeight)
      s.camera.aspect = el.clientWidth / el.clientHeight
      s.camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    s.animId = requestAnimationFrame(function loop() {
      s.animId = requestAnimationFrame(loop)
      const t = s.clock.getElapsedTime()

      // Rotate Earth and clouds
      if (s.earthUpdate) s.earthUpdate(t)

      s.camera.position.x = Math.sin(t * 0.08) * 10
      s.camera.position.z = Math.cos(t * 0.08) * 10
      s.camera.lookAt(0, 0, 0)

      Object.entries(s.sats).forEach(([id, obj]) => {
        if (!obj) return
        const { mesh, orbitRadius, speed, tilt, angleOffset, isAvoiding, avoidOrbitRadius } = obj
        let angle = t * speed + angleOffset
        let r = orbitRadius

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

      if (s.conjLine && s.sats['SAT-001'] && s.sats['SAT-002']) {
        const posA = s.sats['SAT-001'].mesh.position
        const posB = s.sats['SAT-002'].mesh.position
        s.conjLine.geometry.setFromPoints([posA, posB])
        s.conjLine.computeLineDistances()

        if (s.avoiding && s.avoidProgress > 0.5) {
          s.conjLine.material.opacity = Math.max(0, 0.6 * (1 - (s.avoidProgress - 0.5) * 2))
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

  useEffect(() => {
    const s = stateRef.current
    if (!s.scene || !satellites?.length) return

    Object.values(s.sats).forEach(obj => obj && s.scene.remove(obj.mesh))
    s.sats = {}

    const orbitTilts = {
      'SAT-001': 0.2, 'SAT-002': 0.35, 'SAT-003': -0.15, 'DEBRIS-001': 0.5,
    }

    satellites.forEach((sat, i) => {
      const color = SAT_COLORS[sat.operator] || SAT_COLORS.UNKNOWN
      const radius = altToRadius(sat.altitude_km)
      const tilt = orbitTilts[sat.id] ?? (i * 0.2)

      s.scene.add(makeOrbitLine(radius, tilt, color))

      const mesh = makeSatellite(color)
      s.scene.add(mesh)

      // Label
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
        mesh, orbitRadius: radius, avoidOrbitRadius: radius + 0.6,
        speed: 0.3 / (radius / EARTH_RADIUS), tilt,
        angleOffset: i * (Math.PI / 2),
        isAvoiding: sat.id === 'SAT-002',
        currentRadius: radius,
      }
    })

    if (s.sats['SAT-001']) s.sats['SAT-001'].angleOffset = 0
    if (s.sats['SAT-002']) s.sats['SAT-002'].angleOffset = 0.1
  }, [satellites])

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

      {/* Overlay label */}
      <div style={{
        position: 'absolute', top: 12, left: 14,
        fontSize: '9px',
        color: 'var(--text-tertiary)',
        letterSpacing: '0.14em',
        fontFamily: 'var(--font-display)',
        fontWeight: '500',
      }}>
        ORBITAL VISUALIZATION
      </div>

      {/* Avoidance overlay */}
      {status === 'AVOIDED' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '14px 28px',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px',
          fontWeight: '600',
          letterSpacing: '0.12em',
          fontFamily: 'var(--font-display)',
          color: 'var(--status-success)',
          background: 'rgba(14, 20, 32, 0.9)',
          border: '1px solid rgba(61, 220, 132, 0.2)',
          boxShadow: '0 0 30px rgba(61, 220, 132, 0.1)',
          animation: 'fadeInOut 4s ease forwards',
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
        }}>
          COLLISION AVOIDED
        </div>
      )}
    </div>
  )
}
