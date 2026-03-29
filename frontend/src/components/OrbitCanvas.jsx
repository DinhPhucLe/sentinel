import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
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
  GPS:       0x00C8F0,
  STARLINK:  0x90B0C0,
  ISS:       0xD0D8E0,
  DEBRIS:    0x505860,
  JAXA:      0x00B4E0,
  ROSCOSMOS: 0xE07040,
  UNKNOWN:   0x606870,
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

const DEBRIS_SAMPLE_SIZE = 3000

async function loadDebrisCloud(scene) {
  let objects
  try {
    const res = await fetch('/data/globe_debris_leo.json')
    if (!res.ok) return
    objects = await res.json()
  } catch {
    return
  }

  if (objects.length > DEBRIS_SAMPLE_SIZE) {
    for (let i = objects.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[objects[i], objects[j]] = [objects[j], objects[i]]
    }
    objects = objects.slice(0, DEBRIS_SAMPLE_SIZE)
  }

  const positions = new Float32Array(objects.length * 3)

  objects.forEach((obj, i) => {
    const altKm = (obj.APOAPSIS + obj.PERIAPSIS) / 2
    const r = EARTH_RADIUS + (altKm / 6371) * EARTH_RADIUS

    const inc  = (obj.INCLINATION    * Math.PI) / 180
    const raan = (obj.RA_OF_ASC_NODE * Math.PI) / 180
    const anom = (obj.MEAN_ANOMALY   * Math.PI) / 180

    const x_peri = r * Math.cos(anom)
    const y_peri = r * Math.sin(anom)

    positions[i * 3]     = x_peri * Math.cos(raan) - y_peri * Math.cos(inc) * Math.sin(raan)
    positions[i * 3 + 1] = x_peri * Math.sin(raan) + y_peri * Math.cos(inc) * Math.cos(raan)
    positions[i * 3 + 2] = y_peri * Math.sin(inc)
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const mat = new THREE.PointsMaterial({
    color: 0x94a3b8,
    size: 0.012,
    opacity: 0.45,
    transparent: true,
    sizeAttenuation: true,
  })

  scene.add(new THREE.Points(geo, mat))
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
    s.camera.position.set(0, 5, 10)

    // Interactive orbit controls — drag to rotate, scroll to zoom
    s.controls = new OrbitControls(s.camera, s.renderer.domElement)
    s.controls.enableDamping = true
    s.controls.dampingFactor = 0.06
    s.controls.rotateSpeed = 0.5
    s.controls.zoomSpeed = 0.8
    s.controls.minDistance = 5
    s.controls.maxDistance = 25
    s.controls.autoRotate = true
    s.controls.autoRotateSpeed = 0.4
    s.controls.enablePan = false
    s.controls.target.set(0, 0, 0)

    // Stars — multiple layers for depth, varied sizes
    const STAR_COUNT = 3000
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(STAR_COUNT * 3)
    const starSizes = new Float32Array(STAR_COUNT)
    for (let i = 0; i < STAR_COUNT; i++) {
      starPos[i * 3]     = (Math.random() - 0.5) * 100
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 100
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 100
      starSizes[i] = Math.random() * 0.08 + 0.02
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    starGeo.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1))

    const starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.06, transparent: true, opacity: 0.85,
      sizeAttenuation: true,
    })
    const stars = new THREE.Points(starGeo, starMat)
    s.scene.add(stars)
    s.stars = stars

    // Dim far-layer stars for depth
    const farStarGeo = new THREE.BufferGeometry()
    const farPos = new Float32Array(1500 * 3)
    for (let i = 0; i < 1500; i++) {
      farPos[i * 3]     = (Math.random() - 0.5) * 160
      farPos[i * 3 + 1] = (Math.random() - 0.5) * 160
      farPos[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    farStarGeo.setAttribute('position', new THREE.Float32BufferAttribute(farPos, 3))
    s.scene.add(new THREE.Points(farStarGeo, new THREE.PointsMaterial({
      color: 0xaabbcc, size: 0.03, transparent: true, opacity: 0.4, sizeAttenuation: true,
    })))

    // Earth
    const earth = createEarth({ radius: EARTH_RADIUS, segments: 64 })
    s.scene.add(earth.group)
    s.earthUpdate = earth.update

    // Load real debris point cloud (non-blocking — gracefully skipped if unavailable)
    loadDebrisCloud(s.scene)

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

      // Slowly drift stars for a living universe feel
      if (s.stars) {
        s.stars.rotation.y = t * 0.003
        s.stars.rotation.x = t * 0.001
      }

      // Update interactive controls (handles damping + auto-rotate)
      s.controls.update()

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
      s.controls.dispose()
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
          color: 'var(--status-ok)',
          background: 'rgba(13, 18, 25, 0.9)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'none',
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
