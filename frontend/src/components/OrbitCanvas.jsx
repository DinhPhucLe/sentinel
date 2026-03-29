import { useRef, useEffect, useState, useCallback } from 'react'
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

const SAT_COLORS = {
  GPS:      0x00C8F0,
  STARLINK: 0x90B0C0,
  ISS:      0xD0D8E0,
  DEBRIS:   0x505860,
  UNKNOWN:  0x606870,
}

const SAT_HEX = {
  GPS:      '#00C8F0',
  STARLINK: '#90B0C0',
  ISS:      '#D0D8E0',
  DEBRIS:   '#505860',
  UNKNOWN:  '#606870',
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

// ── HUD Components ────────────────────────────────────────────────────

const hudBtn = (active) => ({
  padding: '4px 8px',
  background: active ? 'rgba(94,170,187,0.15)' : 'rgba(7,15,26,0.85)',
  border: `1px solid ${active ? 'rgba(94,170,187,0.4)' : 'rgba(30,58,95,0.8)'}`,
  borderRadius: '4px',
  color: active ? '#5eaabb' : '#475569',
  fontSize: '9px',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.1em',
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
})

function LayerToggle({ label, checked, onChange, color }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 0' }}>
      <div
        onClick={onChange}
        style={{
          width: '28px', height: '14px', borderRadius: '7px',
          background: checked ? 'rgba(94,170,187,0.3)' : 'rgba(30,58,95,0.5)',
          border: `1px solid ${checked ? 'rgba(94,170,187,0.5)' : 'rgba(30,58,95,0.8)'}`,
          position: 'relative', flexShrink: 0, transition: 'all 0.2s', cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: '2px',
          left: checked ? '14px' : '2px',
          width: '8px', height: '8px', borderRadius: '50%',
          background: checked ? '#5eaabb' : '#334155',
          transition: 'left 0.2s',
        }} />
      </div>
      {color && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: checked ? '#94a3b8' : '#334155', letterSpacing: '0.06em' }}>
        {label}
      </span>
    </label>
  )
}

function SatDetailPopup({ sat, events, onClose }) {
  if (!sat) return null
  const conjCount = events?.filter(ev => ev.sat_a?.id === sat.id || ev.sat_b?.id === sat.id).length || 0
  const fuelPct = ((sat.fuel_remaining || 0) * 100).toFixed(0)
  const accentColor = SAT_HEX[sat.operator] || SAT_HEX.UNKNOWN

  return (
    <div style={{
      position: 'absolute', bottom: 14, left: 14,
      width: '200px',
      background: 'rgba(7,15,26,0.92)',
      border: '1px solid rgba(30,58,95,0.9)',
      borderRadius: '6px',
      backdropFilter: 'blur(12px)',
      fontSize: '10px',
      fontFamily: 'var(--font-mono)',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      animation: 'slideIn 0.15s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 10px',
        borderBottom: '1px solid rgba(30,58,95,0.8)',
        background: 'rgba(13,18,25,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: accentColor }} />
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#c8ced8', letterSpacing: '0.06em' }}>
            {sat.name || sat.id}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#334155', cursor: 'pointer',
          fontSize: '14px', lineHeight: 1, padding: '0 2px',
        }}>×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <Row label="ID" value={sat.id} />
        <Row label="OPERATOR" value={sat.operator} color={accentColor} />
        <Row label="ALTITUDE" value={`${(sat.altitude_km || 0).toLocaleString()} km`} />
        <Row label="PRIORITY" value={`P${sat.priority}`} />
        <Row
          label="STATUS"
          value={sat.controllable ? 'CTRL' : 'INERT'}
          color={sat.controllable ? '#5A9A70' : '#A05058'}
        />

        {/* Fuel bar */}
        <div style={{ marginTop: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#334155' }}>FUEL</span>
            <span style={{ color: '#64748b' }}>{fuelPct}%</span>
          </div>
          <div style={{ height: '3px', background: 'rgba(30,58,95,0.6)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${fuelPct}%`, height: '100%', borderRadius: '2px',
              background: fuelPct > 50 ? '#5A9A70' : fuelPct > 20 ? '#B08840' : '#A05058',
              transition: 'width 0.5s',
            }} />
          </div>
        </div>

        {/* Conjunction count */}
        {conjCount > 0 && (
          <div style={{
            marginTop: '4px', padding: '4px 8px',
            background: 'rgba(160,80,88,0.1)',
            border: '1px solid rgba(160,80,88,0.25)',
            borderRadius: '3px',
            color: '#f87171', textAlign: 'center', fontSize: '9px', letterSpacing: '0.08em',
          }}>
            ⚠ {conjCount} ACTIVE CONJUNCTION{conjCount > 1 ? 'S' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#334155', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ color: color || '#64748b' }}>{value}</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────

export default function OrbitCanvas({ satellites, events, decision, status }) {
  const mountRef = useRef(null)
  const stateRef = useRef({
    renderer: null, scene: null, camera: null, animId: null, controls: null,
    sats: {}, orbitLines: {}, conjLine: null, clock: new THREE.Clock(),
    avoidProgress: 0, avoiding: false,
    paused: false,
    dragDist: 0,
  })

  const [paused, setPaused] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showLayers, setShowLayers] = useState(false)
  const [selectedSatId, setSelectedSatId] = useState(null)
  const [autoRotate, setAutoRotate] = useState(true)
  const [rotateSpeed, setRotateSpeed] = useState(0.4)
  const [layers, setLayers] = useState({
    orbitRings: true,
    GPS: true, STARLINK: true, ISS: true, DEBRIS: true,
    conjunctions: true,
    labels: true,
  })

  // ── Three.js init ──────────────────────────────────────────────────
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

    // Track drag distance to suppress spurious clicks
    s.controls.addEventListener('start', () => { s.dragDist = 0 })
    s.controls.addEventListener('change', () => { s.dragDist++ })

    // Stars
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(3000 * 3)
    for (let i = 0; i < 3000; i++) {
      starPos[i * 3]     = (Math.random() - 0.5) * 100
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 100
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 100
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    s.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.06, transparent: true, opacity: 0.85, sizeAttenuation: true,
    }))
    s.scene.add(s.stars)

    const farGeo = new THREE.BufferGeometry()
    const farPos = new Float32Array(1500 * 3)
    for (let i = 0; i < 1500; i++) {
      farPos[i * 3]     = (Math.random() - 0.5) * 160
      farPos[i * 3 + 1] = (Math.random() - 0.5) * 160
      farPos[i * 3 + 2] = (Math.random() - 0.5) * 160
    }
    farGeo.setAttribute('position', new THREE.Float32BufferAttribute(farPos, 3))
    s.scene.add(new THREE.Points(farGeo, new THREE.PointsMaterial({
      color: 0xaabbcc, size: 0.03, transparent: true, opacity: 0.4, sizeAttenuation: true,
    })))

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
      if (s.paused) return

      const t = s.clock.getElapsedTime()
      if (s.earthUpdate) s.earthUpdate(t)
      if (s.stars) { s.stars.rotation.y = t * 0.003; s.stars.rotation.x = t * 0.001 }
      s.controls.update()

      Object.entries(s.sats).forEach(([, obj]) => {
        if (!obj || !obj.mesh.visible) return
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
      if (el.contains(s.renderer.domElement)) el.removeChild(s.renderer.domElement)
    }
  }, [])

  // ── Satellites ─────────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene || !satellites?.length) return

    Object.values(s.sats).forEach(obj => obj && s.scene.remove(obj.mesh))
    Object.values(s.orbitLines).forEach(l => l && s.scene.remove(l))
    s.sats = {}
    s.orbitLines = {}

    const orbitTilts = {
      'SAT-001': 0.2, 'SAT-002': 0.35, 'SAT-003': -0.15, 'DEBRIS-001': 0.5,
    }

    satellites.forEach((sat, i) => {
      const color = SAT_COLORS[sat.operator] || SAT_COLORS.UNKNOWN
      const radius = altToRadius(sat.altitude_km)
      const tilt = orbitTilts[sat.id] ?? (i * 0.2)

      const line = makeOrbitLine(radius, tilt, color)
      s.scene.add(line)
      s.orbitLines[sat.id] = line

      const mesh = makeSatellite(color)
      s.scene.add(mesh)

      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.font = '22px monospace'
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0')
      ctx.fillText(sat.name || sat.id, 8, 40)
      const tex = new THREE.CanvasTexture(canvas)
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 0.3),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
      )
      label.position.set(0, 0.25, 0)
      mesh.add(label)
      s.orbitLines[sat.id + '_label'] = label // store label ref for toggling

      s.sats[sat.id] = {
        mesh, orbitRadius: radius, avoidOrbitRadius: radius + 0.6,
        speed: 0.3 / (radius / EARTH_RADIUS), tilt,
        angleOffset: i * (Math.PI / 2),
        isAvoiding: sat.id === 'SAT-002',
        currentRadius: radius,
        operator: sat.operator,
      }
    })

    if (s.sats['SAT-001']) s.sats['SAT-001'].angleOffset = 0
    if (s.sats['SAT-002']) s.sats['SAT-002'].angleOffset = 0.1
  }, [satellites])

  // ── Events / conjunction line ──────────────────────────────────────
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

  // ── Status / avoidance ────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (status === 'AVOIDED' && decision) { s.avoiding = true; s.avoidProgress = 0 }
    if (status === 'MONITORING') { s.avoiding = false; s.avoidProgress = 0 }
  }, [status, decision])

  // ── Pause ─────────────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    s.paused = paused
    if (s.controls) s.controls.autoRotate = !paused && autoRotate
  }, [paused, autoRotate])

  // ── Rotate speed ──────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (s.controls) s.controls.autoRotateSpeed = rotateSpeed
  }, [rotateSpeed])

  // ── Layers visibility ─────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    Object.entries(s.sats).forEach(([satId, obj]) => {
      if (!obj) return
      const op = obj.operator || 'UNKNOWN'
      const satVisible = layers[op] !== false
      obj.mesh.visible = satVisible
      // Label visibility
      const label = s.orbitLines[satId + '_label']
      if (label) label.visible = satVisible && layers.labels
    })
    Object.entries(s.orbitLines).forEach(([key, line]) => {
      if (!line || key.endsWith('_label')) return
      const obj = s.sats[key]
      const op = obj?.operator || 'UNKNOWN'
      line.visible = layers.orbitRings && (layers[op] !== false)
    })
    if (s.conjLine) s.conjLine.visible = layers.conjunctions
  }, [layers])

  // ── Click → select satellite ──────────────────────────────────────
  const handleClick = useCallback((e) => {
    const s = stateRef.current
    if (!s.scene || !s.camera || s.dragDist > 3) return

    const el = mountRef.current
    const rect = el.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points = { threshold: 0.1 }
    raycaster.setFromCamera(mouse, s.camera)

    const meshes = Object.values(s.sats)
      .filter(obj => obj && obj.mesh.visible)
      .map(obj => obj.mesh)

    const hits = raycaster.intersectObjects(meshes, true)
    if (hits.length > 0) {
      const hitObj = hits[0].object
      const satId = Object.keys(s.sats).find(id => {
        const obj = s.sats[id]
        return obj && (obj.mesh === hitObj || obj.mesh.children.some(c => c === hitObj || c.children?.includes(hitObj)))
      })
      if (satId) { setSelectedSatId(prev => prev === satId ? null : satId); return }
    }
    setSelectedSatId(null)
  }, [])

  const selectedSat = satellites?.find(s => s.id === selectedSatId)

  const toggleLayer = (key) => setLayers(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300 }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} onClick={handleClick} />

      {/* Top-left label */}
      <div style={{
        position: 'absolute', top: 12, left: 14,
        fontSize: '9px', color: 'var(--text-tertiary)',
        letterSpacing: '0.14em', fontFamily: 'var(--font-display)', fontWeight: '500',
        pointerEvents: 'none',
      }}>
        ORBITAL VISUALIZATION
      </div>

      {/* Top-right HUD buttons */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        display: 'flex', gap: '5px', alignItems: 'center',
      }}>
        {/* Pause / Resume */}
        <button
          style={hudBtn(paused)}
          onClick={() => { setPaused(p => !p); setShowSettings(false); setShowLayers(false) }}
        >
          {paused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>

        {/* Settings */}
        <button
          style={hudBtn(showSettings)}
          onClick={() => { setShowSettings(p => !p); setShowLayers(false) }}
        >
          ⚙ CONTROLS
        </button>

        {/* Layers */}
        <button
          style={hudBtn(showLayers)}
          onClick={() => { setShowLayers(p => !p); setShowSettings(false) }}
        >
          ☰ LAYERS
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{
          position: 'absolute', top: 38, right: 10,
          width: '190px',
          background: 'rgba(7,15,26,0.92)',
          border: '1px solid rgba(30,58,95,0.9)',
          borderRadius: '6px',
          padding: '10px 12px',
          backdropFilter: 'blur(12px)',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          animation: 'slideIn 0.12s ease',
          zIndex: 10,
        }}>
          <div style={{ fontSize: '9px', color: '#334155', letterSpacing: '0.12em', marginBottom: '10px' }}>
            CAMERA CONTROLS
          </div>

          <LayerToggle
            label="AUTO ROTATE"
            checked={autoRotate}
            onChange={() => setAutoRotate(p => !p)}
          />

          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ color: '#475569' }}>ROTATE SPEED</span>
              <span style={{ color: '#64748b' }}>{rotateSpeed.toFixed(1)}</span>
            </div>
            <input
              type="range" min="0.1" max="2.0" step="0.1"
              value={rotateSpeed}
              onChange={e => setRotateSpeed(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#5eaabb', cursor: 'pointer' }}
            />
          </div>

          <div style={{ marginTop: '6px', fontSize: '9px', color: '#1e3a5f', letterSpacing: '0.06em', lineHeight: 1.6 }}>
            DRAG to orbit · SCROLL to zoom
          </div>
        </div>
      )}

      {/* Layers panel */}
      {showLayers && (
        <div style={{
          position: 'absolute', top: 38, right: 10,
          width: '190px',
          background: 'rgba(7,15,26,0.92)',
          border: '1px solid rgba(30,58,95,0.9)',
          borderRadius: '6px',
          padding: '10px 12px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          animation: 'slideIn 0.12s ease',
          zIndex: 10,
        }}>
          <div style={{ fontSize: '9px', color: '#334155', letterSpacing: '0.12em', marginBottom: '6px' }}>
            OBJECT LAYERS
          </div>
          <LayerToggle label="ORBIT RINGS" checked={layers.orbitRings} onChange={() => toggleLayer('orbitRings')} />
          <LayerToggle label="LABELS" checked={layers.labels} onChange={() => toggleLayer('labels')} />

          <div style={{ height: '1px', background: 'rgba(30,58,95,0.5)', margin: '8px 0' }} />
          <div style={{ fontSize: '9px', color: '#334155', letterSpacing: '0.12em', marginBottom: '6px' }}>
            OPERATORS
          </div>
          <LayerToggle label="GPS" checked={layers.GPS} onChange={() => toggleLayer('GPS')} color={SAT_HEX.GPS} />
          <LayerToggle label="STARLINK" checked={layers.STARLINK} onChange={() => toggleLayer('STARLINK')} color={SAT_HEX.STARLINK} />
          <LayerToggle label="ISS" checked={layers.ISS} onChange={() => toggleLayer('ISS')} color={SAT_HEX.ISS} />
          <LayerToggle label="DEBRIS" checked={layers.DEBRIS} onChange={() => toggleLayer('DEBRIS')} color={SAT_HEX.DEBRIS} />

          <div style={{ height: '1px', background: 'rgba(30,58,95,0.5)', margin: '8px 0' }} />
          <div style={{ fontSize: '9px', color: '#334155', letterSpacing: '0.12em', marginBottom: '6px' }}>
            CONJUNCTIONS
          </div>
          <LayerToggle label="CONJUNCTION LINE" checked={layers.conjunctions} onChange={() => toggleLayer('conjunctions')} />
        </div>
      )}

      {/* Satellite detail popup */}
      {selectedSat && (
        <SatDetailPopup
          sat={selectedSat}
          events={events}
          onClose={() => setSelectedSatId(null)}
        />
      )}

      {/* Avoidance overlay */}
      {status === 'AVOIDED' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '14px 28px',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px', fontWeight: '600',
          letterSpacing: '0.12em', fontFamily: 'var(--font-display)',
          color: 'var(--status-ok)',
          background: 'rgba(13, 18, 25, 0.9)',
          border: '1px solid var(--border-subtle)',
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
