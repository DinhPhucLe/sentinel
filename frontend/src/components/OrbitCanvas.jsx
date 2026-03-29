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
  GPS: 0x00C8F0, STARLINK: 0x90B0C0, ISS: 0xD0D8E0, DEBRIS: 0x505860,
  JAXA: 0x00B4E0, ROSCOSMOS: 0xE07040, UNKNOWN: 0x606870,
}
const SAT_HEX = {
  GPS: '#00C8F0', STARLINK: '#90B0C0', ISS: '#D0D8E0', DEBRIS: '#505860', UNKNOWN: '#606870',
}

const CONJ_TIERS = [
  { key: 'CRITICAL', label: 'CRITICAL', color: '#f87171', test: p => p >= 0.7 },
  { key: 'HIGH',     label: 'HIGH',     color: '#fb923c', test: p => p >= 0.4 && p < 0.7 },
  { key: 'MEDIUM',   label: 'MEDIUM',   color: '#fbbf24', test: p => p >= 0.2 && p < 0.4 },
  { key: 'LOW',      label: 'LOW',      color: '#34d399', test: p => p < 0.2 },
]
const CONJ_COLOR_THREE = { CRITICAL: 0xf87171, HIGH: 0xfb923c, MEDIUM: 0xfbbf24, LOW: 0x34d399 }

function getEventTier(prob) {
  return CONJ_TIERS.find(t => t.test(prob))?.key ?? 'LOW'
}

// ── Three.js helpers ──────────────────────────────────────────────────

function makeOrbitLine(radius, tilt = 0, color = 0x1a2535, opacity = 0.2, dashed = false) {
  const points = []
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius * Math.sin(tilt), Math.sin(a) * radius * Math.cos(tilt)))
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  let mat
  if (dashed) {
    mat = new THREE.LineDashedMaterial({ color, opacity, transparent: true, dashSize: 0.2, gapSize: 0.1 })
    const line = new THREE.Line(geo, mat)
    line.computeLineDistances()
    return line
  }
  mat = new THREE.LineBasicMaterial({ color, opacity, transparent: true })
  return new THREE.Line(geo, mat)
}

function makeSatellite(color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color }))
  mesh.add(new THREE.Mesh(
    new THREE.RingGeometry(0.09, 0.12, 16),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, opacity: 0.3, transparent: true }),
  ))
  return mesh
}

function makeConjLine(posA, posB, tierKey) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...posA), new THREE.Vector3(...posB)])
  const mat = new THREE.LineDashedMaterial({
    color: CONJ_COLOR_THREE[tierKey] ?? 0xe04050, dashSize: 0.15, gapSize: 0.08, opacity: 0.6, transparent: true,
  })
  const line = new THREE.Line(geo, mat)
  line.computeLineDistances()
  return line
}

function makeTrackingRing() {
  const pts = []
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0))
  }
  const mat = new THREE.LineDashedMaterial({ color: 0x5eaabb, dashSize: 0.07, gapSize: 0.03, opacity: 0.9, transparent: true })
  const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat)
  ring.computeLineDistances()
  return ring
}

function makeSolidLine(color = 0xff2040) {
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)]
  const mat = new THREE.LineBasicMaterial({ color, opacity: 0.85, transparent: true })
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat)
}

function makeGreenArcLine(nPoints = 64) {
  const pts = Array.from({ length: nPoints }, () => new THREE.Vector3())
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  const mat = new THREE.LineDashedMaterial({ color: 0x4ade80, dashSize: 0.1, gapSize: 0.05, opacity: 0.85, transparent: true })
  const line = new THREE.Line(geo, mat)
  line.computeLineDistances()
  return line
}

function makeArrow() {
  return new THREE.Mesh(
    new THREE.ConeGeometry(0.025, 0.065, 6),
    new THREE.MeshBasicMaterial({ color: 0x4ade80, opacity: 0.8, transparent: true }),
  )
}

function makeKesslerFlash(pos) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 1, transparent: true }),
  )
  mesh.position.copy(pos)
  return mesh
}

function makeKesslerRing(pos) {
  const pts = []
  for (let i = 0; i <= 80; i++) {
    const a = (i / 80) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0))
  }
  const mat = new THREE.LineBasicMaterial({ color: 0xff4020, opacity: 0.7, transparent: true })
  const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat)
  ring.position.copy(pos)
  return ring
}

// ── HUD sub-components ────────────────────────────────────────────────

const PANEL_STYLE = {
  position: 'absolute', top: 42, right: 10, width: '210px',
  background: 'rgba(5,10,20,0.94)', border: '1px solid rgba(30,58,95,0.85)',
  borderRadius: '6px', backdropFilter: 'blur(14px)',
  boxShadow: '0 6px 28px rgba(0,0,0,0.55)', zIndex: 10,
  fontSize: '11px', fontFamily: 'var(--font-mono)', overflow: 'hidden',
}

function PanelHeader({ title, action, onAction }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px', borderBottom: '1px solid rgba(30,58,95,0.7)',
      background: 'rgba(10,16,28,0.5)',
    }}>
      <span style={{ fontSize: '11px', fontWeight: '600', color: '#c8ced8', letterSpacing: '0.1em' }}>{title}</span>
      {action && (
        <button onClick={onAction} style={{
          padding: '2px 8px', background: 'rgba(94,170,187,0.08)',
          border: '1px solid rgba(94,170,187,0.25)', borderRadius: '3px',
          color: '#5eaabb', fontSize: '9px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
        }}>{action}</button>
      )}
    </div>
  )
}

function Checkbox({ checked, onChange }) {
  return (
    <div onClick={onChange} style={{
      width: '14px', height: '14px', flexShrink: 0,
      background: checked ? '#5eaabb' : 'transparent',
      border: `1px solid ${checked ? '#5eaabb' : 'rgba(71,85,105,0.6)'}`,
      borderRadius: '2px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
    }}>
      {checked && <span style={{ color: '#fff', fontSize: '9px', lineHeight: 1, fontWeight: '700' }}>✓</span>}
    </div>
  )
}

function SliderRow({ label, value, min, max, step, onChange, display }) {
  return (
    <div style={{ padding: '6px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '10px', color: '#475569', letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ fontSize: '10px', color: '#64748b' }}>{display ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#5eaabb', cursor: 'pointer', height: '3px' }}
      />
    </div>
  )
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 12px', borderTop: '1px solid rgba(30,58,95,0.4)',
    }}>
      <span style={{ fontSize: '10px', color: '#475569', letterSpacing: '0.08em' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{ fontSize: '10px', color: checked ? '#5eaabb' : '#334155' }}>{checked ? 'ON' : 'OFF'}</span>
        <div onClick={onChange} style={{
          width: '32px', height: '16px', borderRadius: '8px',
          background: checked ? 'rgba(94,170,187,0.35)' : 'rgba(30,58,95,0.5)',
          border: `1px solid ${checked ? 'rgba(94,170,187,0.6)' : 'rgba(30,58,95,0.8)'}`,
          cursor: 'pointer', position: 'relative', transition: 'all 0.2s',
        }}>
          <div style={{
            position: 'absolute', top: '3px', left: checked ? '16px' : '3px',
            width: '8px', height: '8px', borderRadius: '50%',
            background: checked ? '#5eaabb' : '#334155', transition: 'left 0.2s',
          }} />
        </div>
      </div>
    </div>
  )
}

function LayersPanel({ satellites, events, layers, onToggle, onShowAll }) {
  const [satExpanded, setSatExpanded] = useState(true)
  const visibleSats = satellites.filter(s => layers.sats[s.id] !== false).length
  const tierCounts = {}
  CONJ_TIERS.forEach(t => { tierCounts[t.key] = (events ?? []).filter(ev => getEventTier(ev.collision_probability) === t.key).length })

  return (
    <div style={PANEL_STYLE}>
      <PanelHeader title="LAYERS" action="SHOW ALL" onAction={onShowAll} />
      <div style={{ padding: '8px 12px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
          <Checkbox checked={layers.orbitRings} onChange={() => onToggle('orbitRings')} />
          <span style={{ color: layers.orbitRings ? '#94a3b8' : '#334155' }}>Orbital Shell Rings</span>
        </div>
      </div>
      <div style={{ height: '1px', background: 'rgba(30,58,95,0.5)', margin: '2px 0' }} />
      <div style={{ padding: '4px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', cursor: 'pointer' }}
          onClick={() => setSatExpanded(p => !p)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#334155', fontSize: '10px', display: 'inline-block', transform: satExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
            <span style={{ color: '#64748b', fontSize: '10px', letterSpacing: '0.08em' }}>
              SPACE OBJECTS <span style={{ color: '#334155' }}>({visibleSats}/{satellites.length})</span>
            </span>
          </div>
          <button onClick={e => { e.stopPropagation(); satellites.forEach(s => layers.sats[s.id] === false && onToggle('sat_' + s.id)) }}
            style={{ padding: '1px 7px', background: 'rgba(94,170,187,0.06)', border: '1px solid rgba(94,170,187,0.2)', borderRadius: '3px', color: '#5eaabb', fontSize: '9px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>ALL</button>
        </div>
        {satExpanded && satellites.map(sat => {
          const visible = layers.sats[sat.id] !== false
          return (
            <div key={sat.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '3px 0 3px 12px' }}>
              <Checkbox checked={visible} onChange={() => onToggle('sat_' + sat.id)} />
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: SAT_HEX[sat.operator] ?? SAT_HEX.UNKNOWN, flexShrink: 0 }} />
              <span style={{ color: visible ? '#94a3b8' : '#334155', fontSize: '10px' }}>{sat.name || sat.id}</span>
            </div>
          )
        })}
      </div>
      <div style={{ height: '1px', background: 'rgba(30,58,95,0.5)', margin: '2px 0' }} />
      <div style={{ padding: '4px 12px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 6px' }}>
          <span style={{ color: '#64748b', fontSize: '10px', letterSpacing: '0.08em' }}>CONJUNCTIONS</span>
          <button onClick={() => CONJ_TIERS.forEach(t => layers.conjTiers[t.key] && onToggle('tier_' + t.key))}
            style={{ padding: '1px 7px', background: 'rgba(160,80,88,0.08)', border: '1px solid rgba(160,80,88,0.25)', borderRadius: '3px', color: '#f87171', fontSize: '9px', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>NONE</button>
        </div>
        {CONJ_TIERS.map(tier => {
          const checked = layers.conjTiers[tier.key] !== false
          return (
            <div key={tier.key} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '3px 0' }}>
              <Checkbox checked={checked} onChange={() => onToggle('tier_' + tier.key)} />
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: tier.color, flexShrink: 0 }} />
              <span style={{ color: checked ? '#94a3b8' : '#334155', flex: 1, fontSize: '10px' }}>{tier.label}</span>
              <span style={{ color: '#1e3a5f', fontSize: '10px' }}>{tierCounts[tier.key]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SettingsPanel({ sensitivity, onSensitivity, simSpeed, onSimSpeed, invertY, onInvertY, invertX, onInvertX }) {
  return (
    <div style={PANEL_STYLE}>
      <PanelHeader title="DISPLAY SETTINGS" />
      <SliderRow label="SENSITIVITY" value={sensitivity} min={0.1} max={2.0} step={0.1} onChange={onSensitivity} display={sensitivity.toFixed(1)} />
      <SliderRow label="SIMULATION SPEED" value={simSpeed} min={0.1} max={5.0} step={0.1} onChange={onSimSpeed} display={simSpeed.toFixed(1)} />
      <ToggleRow label="INVERT VERTICAL DRAG" checked={invertY} onChange={onInvertY} />
      <ToggleRow label="INVERT HORIZONTAL DRAG" checked={invertX} onChange={onInvertX} />
    </div>
  )
}

function SatDetailPopup({ sat, events, onClose }) {
  if (!sat) return null
  const conjCount = events?.filter(ev => ev.sat_a?.id === sat.id || ev.sat_b?.id === sat.id).length ?? 0
  const fuelPct = Math.round((sat.fuel_remaining ?? 0) * 100)
  const accent = SAT_HEX[sat.operator] ?? SAT_HEX.UNKNOWN
  return (
    <div style={{
      position: 'absolute', bottom: 14, left: 14, width: '196px',
      background: 'rgba(5,10,20,0.94)', border: '1px solid rgba(30,58,95,0.9)',
      borderRadius: '6px', backdropFilter: 'blur(14px)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.55)', overflow: 'hidden',
      fontFamily: 'var(--font-mono)', fontSize: '10px', animation: 'slideIn 0.12s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid rgba(30,58,95,0.7)', background: 'rgba(10,16,28,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: accent }} />
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#c8ced8' }}>{sat.name || sat.id}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {[['ID', sat.id], ['OPERATOR', sat.operator, accent], ['ALTITUDE', `${(sat.altitude_km ?? 0).toLocaleString()} km`], ['PRIORITY', `P${sat.priority}`], ['STATUS', sat.controllable ? 'CONTROLLABLE' : 'INERT', sat.controllable ? '#5A9A70' : '#A05058']].map(([l, v, c]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#334155' }}>{l}</span>
            <span style={{ color: c ?? '#64748b' }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#334155' }}>FUEL</span>
            <span style={{ color: '#64748b' }}>{fuelPct}%</span>
          </div>
          <div style={{ height: '3px', background: 'rgba(30,58,95,0.5)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${fuelPct}%`, height: '100%', background: fuelPct > 50 ? '#5A9A70' : fuelPct > 20 ? '#B08840' : '#A05058', borderRadius: '2px' }} />
          </div>
        </div>
        {conjCount > 0 && (
          <div style={{ marginTop: '3px', padding: '4px 8px', textAlign: 'center', background: 'rgba(160,80,88,0.1)', border: '1px solid rgba(160,80,88,0.25)', borderRadius: '3px', color: '#f87171', fontSize: '9px' }}>
            ⚠ {conjCount} ACTIVE CONJUNCTION{conjCount > 1 ? 'S' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────

export default function OrbitCanvas({ satellites, events, decision, status, simMode, kesslerMode, onEndSim }) {
  const mountRef = useRef(null)
  const stateRef = useRef({
    renderer: null, scene: null, camera: null, animId: null, controls: null,
    sats: {}, orbitLines: {}, conjLines: {}, clock: new THREE.Clock(),
    avoidProgress: 0, avoiding: false, paused: false, simSpeed: 1.0, dragDist: 0,
    // Sim mode
    simPhase: null, simLerpT: 0,
    simEnterCamStart: null, simEnterTargetStart: null,
    simExitCamStart: null, simExitTargetStart: null,
    simFocusId: null, simPartnerFocusId: null,
    simTrackingRing: null, simPartnerOrbitLine: null, simPOVOrbitLine: null,
    simRedLine: null, simGreenArc: null, simArrows: [],
    simRingAngle: 0,
    // Kessler
    kesslerEffects: [],
  })

  const [paused, setPaused] = useState(false)
  const [activePanel, setActivePanel] = useState(null)
  const [selectedSatId, setSelectedSatId] = useState(null)
  const [focusSatId, setFocusSatId] = useState(null)
  const [sensitivity, setSensitivity] = useState(1.0)
  const [simSpeed, setSimSpeed] = useState(1.0)
  const [invertY, setInvertY] = useState(true)
  const [invertX, setInvertX] = useState(false)
  const [layers, setLayers] = useState({
    orbitRings: true,
    sats: {},
    conjTiers: { CRITICAL: true, HIGH: true, MEDIUM: true, LOW: true },
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
    s.controls.addEventListener('start', () => { s.dragDist = 0 })
    s.controls.addEventListener('change', () => { s.dragDist++ })

    // Stars
    const makeStars = (count, spread, size, opacity, color) => {
      const pos = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) { pos[i*3]=(Math.random()-0.5)*spread; pos[i*3+1]=(Math.random()-0.5)*spread; pos[i*3+2]=(Math.random()-0.5)*spread }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity, sizeAttenuation: true }))
      s.scene.add(pts)
      return pts
    }
    s.stars = makeStars(3000, 100, 0.06, 0.85, 0xffffff)
    makeStars(1500, 160, 0.03, 0.4, 0xaabbcc)

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
      const delta = s.clock.getDelta ? 0.016 : 0.016

      if (s.earthUpdate) s.earthUpdate(t)
      if (s.stars) { s.stars.rotation.y = t * 0.003; s.stars.rotation.x = t * 0.001 }

      // ── Satellite orbit animation ─────────────────────────────────
      const inSim = s.simPhase !== null

      Object.entries(s.sats).forEach(([satId, obj]) => {
        if (!obj) return

        // In sim mode: hide non-focus satellites
        if (inSim) {
          obj.mesh.visible = satId === s.simFocusId || satId === s.simPartnerFocusId
        }

        if (!obj.mesh.visible) return

        const { mesh, orbitRadius, speed, tilt, angleOffset, isAvoiding, avoidOrbitRadius } = obj
        const angle = t * speed * s.simSpeed + angleOffset
        let r = orbitRadius

        if (isAvoiding && s.avoiding) {
          s.avoidProgress = Math.min(s.avoidProgress + 0.004, 1)
          r = orbitRadius + (avoidOrbitRadius - orbitRadius) * (1 - Math.pow(1 - s.avoidProgress, 3))
          obj.currentRadius = r
        }

        mesh.position.set(
          Math.cos(angle) * r,
          Math.sin(angle) * r * Math.sin(tilt),
          Math.sin(angle) * r * Math.cos(tilt),
        )
      })

      // ── Conjunction lines ─────────────────────────────────────────
      Object.entries(s.conjLines).forEach(([, line]) => {
        if (!line || !line._eventData) return
        const objA = s.sats[line._eventData.sat_a?.id]
        const objB = s.sats[line._eventData.sat_b?.id]
        if (objA && objB) {
          line.geometry.setFromPoints([objA.mesh.position, objB.mesh.position])
          line.computeLineDistances()
        }
        if (s.avoiding && s.avoidProgress > 0.5) {
          line.material.opacity = Math.max(0, 0.6 * (1 - (s.avoidProgress - 0.5) * 2))
        }
      })

      // ── Sim camera transitions ────────────────────────────────────
      if (s.simPhase === 'entering') {
        s.simLerpT = Math.min(s.simLerpT + 0.018, 1)
        const ease = 1 - Math.pow(1 - s.simLerpT, 3)
        const focused = s.sats[s.simFocusId]
        if (focused) {
          const satPos = focused.mesh.position
          // Behind = radially outward from Earth + 2.8 units
          const behind = satPos.clone().normalize().multiplyScalar(satPos.length() + 2.8)
          s.camera.position.lerpVectors(s.simEnterCamStart, behind, ease)
          s.controls.target.lerpVectors(s.simEnterTargetStart, satPos, ease)
        }
        if (s.simLerpT >= 1) {
          s.simPhase = 'active'
          s.controls.minDistance = 0.4
          s.controls.maxDistance = 5.0
          s.controls.zoomSpeed = 2.5
        }
      }

      if (s.simPhase === 'active') {
        const focused = s.sats[s.simFocusId]
        if (focused) s.controls.target.copy(focused.mesh.position)
      }

      if (s.simPhase === 'exiting') {
        s.simLerpT = Math.min(s.simLerpT + 0.012, 1)
        const ease = 1 - Math.pow(1 - s.simLerpT, 3)
        s.camera.position.lerpVectors(s.simExitCamStart, new THREE.Vector3(0, 5, 10), ease)
        s.controls.target.lerpVectors(s.simExitTargetStart, new THREE.Vector3(0, 0, 0), ease)
        if (s.simLerpT >= 1) {
          s.simPhase = null
          s.controls.minDistance = 5
          s.controls.maxDistance = 25
          s.controls.zoomSpeed = 0.8
          s.controls.autoRotate = !s.paused
        }
      }

      // ── Tracking ring (follows + faces camera) ────────────────────
      if (s.simTrackingRing && (s.simPhase === 'active' || s.simPhase === 'entering')) {
        const focused = s.sats[s.simFocusId]
        if (focused) {
          s.simTrackingRing.position.copy(focused.mesh.position)
          s.simTrackingRing.quaternion.copy(s.camera.quaternion)
          s.simRingAngle += 0.018
          const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), s.simRingAngle)
          s.simTrackingRing.quaternion.multiply(spin)
        }
      }

      // ── Red line (between the two sim objects) ────────────────────
      if (s.simRedLine && s.simFocusId && s.simPartnerFocusId) {
        const a = s.sats[s.simFocusId]
        const b = s.sats[s.simPartnerFocusId]
        if (a && b) {
          s.simRedLine.geometry.setFromPoints([a.mesh.position, b.mesh.position])
        }
      }

      // ── Green maneuver arc (POV sat must be controllable) ─────────
      if (s.simGreenArc && s.simFocusId) {
        const obj = s.sats[s.simFocusId]
        if (obj && s.simFocusControllable) {
          const { orbitRadius, speed, tilt, angleOffset } = obj
          const r = orbitRadius + 0.14
          const curAngle = t * speed * s.simSpeed + angleOffset
          const pts = []
          for (let i = 0; i <= 64; i++) {
            const a = curAngle + (i / 64) * Math.PI
            pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * Math.sin(tilt), Math.sin(a) * r * Math.cos(tilt)))
          }
          s.simGreenArc.geometry.setFromPoints(pts)
          s.simGreenArc.computeLineDistances()
          // Update 7 arrow cones
          s.simArrows.forEach((cone, idx) => {
            const frac = (idx + 0.5) / 7
            const a = curAngle + frac * Math.PI
            const a2 = a + 0.06
            const pos = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * Math.sin(tilt), Math.sin(a) * r * Math.cos(tilt))
            const next = new THREE.Vector3(Math.cos(a2) * r, Math.sin(a2) * r * Math.sin(tilt), Math.sin(a2) * r * Math.cos(tilt))
            cone.position.copy(pos)
            cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), next.clone().sub(pos).normalize())
          })
          s.simGreenArc.visible = true
          s.simArrows.forEach(c => { c.visible = true })
        } else if (s.simGreenArc) {
          s.simGreenArc.visible = false
          s.simArrows.forEach(c => { c.visible = false })
        }
      }

      // ── Kessler cascade effects ───────────────────────────────────
      s.kesslerEffects = s.kesslerEffects.filter(fx => {
        fx.age += 0.016
        const t2 = fx.age / fx.duration
        if (fx.type === 'flash') {
          fx.mesh.scale.setScalar(1 + t2 * 4)
          fx.mesh.material.opacity = Math.max(0, 1 - t2 * 2)
        } else if (fx.type === 'ring') {
          fx.mesh.scale.setScalar(0.1 + t2 * 3.5)
          fx.mesh.material.opacity = Math.max(0, 0.7 - t2 * 0.7)
        } else if (fx.type === 'debris') {
          fx.mesh.scale.setScalar(0.05 + t2 * 2)
          fx.mesh.material.opacity = Math.max(0, 0.4 - t2 * 0.5)
        }
        if (t2 >= 1) { s.scene.remove(fx.mesh); return false }
        return true
      })

      s.controls.update()
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
    s.sats = {}; s.orbitLines = {}

    const orbitTilts = { 'SAT-001': 0.2, 'SAT-002': 0.35, 'SAT-003': -0.15, 'DEBRIS-001': 0.5 }

    satellites.forEach((sat, i) => {
      const color = SAT_COLORS[sat.operator] || SAT_COLORS.UNKNOWN
      const radius = altToRadius(sat.altitude_km)
      const tilt = orbitTilts[sat.id] ?? (i * 0.2)

      const line = makeOrbitLine(radius, tilt, color)
      s.scene.add(line); s.orbitLines[sat.id] = line

      const mesh = makeSatellite(color)
      s.scene.add(mesh)

      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.font = '22px monospace'
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0')
      ctx.fillText(sat.name || sat.id, 8, 40)
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 0.3),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }),
      )
      label.position.set(0, 0.25, 0)
      mesh.add(label)
      s.orbitLines[sat.id + '_label'] = label

      s.sats[sat.id] = {
        mesh, orbitRadius: radius, avoidOrbitRadius: radius + 0.6,
        speed: 0.3 / (radius / EARTH_RADIUS), tilt, angleOffset: i * (Math.PI / 2),
        isAvoiding: sat.id === 'SAT-002', currentRadius: radius,
        operator: sat.operator, controllable: sat.controllable,
      }
    })

    if (s.sats['SAT-001']) s.sats['SAT-001'].angleOffset = 0
    if (s.sats['SAT-002']) s.sats['SAT-002'].angleOffset = 0.1

    setLayers(prev => {
      const sats = { ...prev.sats }
      satellites.forEach(sat => { if (!(sat.id in sats)) sats[sat.id] = true })
      return { ...prev, sats }
    })
  }, [satellites])

  // ── Events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return
    Object.values(s.conjLines).forEach(l => l && s.scene.remove(l))
    s.conjLines = {}
    if (!events?.length) return
    events.forEach(ev => {
      const objA = s.sats[ev.sat_a?.id]
      const objB = s.sats[ev.sat_b?.id]
      if (!objA || !objB) return
      const tier = getEventTier(ev.collision_probability)
      const line = makeConjLine(objA.mesh.position.toArray(), objB.mesh.position.toArray(), tier)
      line._eventData = ev; line._tier = tier
      s.scene.add(line)
      s.conjLines[ev.id] = line
    })
  }, [events, satellites])

  // ── Status ─────────────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (status === 'AVOIDED' && decision) { s.avoiding = true; s.avoidProgress = 0 }
    if (status === 'MONITORING') { s.avoiding = false; s.avoidProgress = 0 }
  }, [status, decision])

  // ── Sim mode ───────────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return

    if (simMode) {
      // Determine which sat is POV (prefer controllable for maneuver perspective)
      const satA = satellites?.find(sv => sv.id === simMode.satAId)
      const satB = satellites?.find(sv => sv.id === simMode.satBId)
      const focusId = (satA?.controllable && !satA?.operator?.includes('GPS')) ? simMode.satAId : simMode.satBId
      const partnerId = focusId === simMode.satAId ? simMode.satBId : simMode.satAId

      s.simFocusId = focusId
      s.simPartnerFocusId = partnerId
      s.simFocusControllable = satellites?.find(sv => sv.id === focusId)?.controllable ?? false

      // Store initial camera positions for lerp
      s.simEnterCamStart = s.camera.position.clone()
      s.simEnterTargetStart = s.controls.target.clone()
      s.simLerpT = 0
      s.simPhase = 'entering'
      s.controls.autoRotate = false

      // ── Add sim-specific Three.js objects ──────────────────────────
      // Tracking ring
      const ring = makeTrackingRing()
      s.scene.add(ring); s.simTrackingRing = ring
      s.simRingAngle = 0

      // Grey orbit rings for both objects
      const focusObj = s.sats[focusId]
      const partnerObj = s.sats[partnerId]

      if (focusObj) {
        const povLine = makeOrbitLine(focusObj.orbitRadius, focusObj.tilt, 0xaaaaaa, 0.25, true)
        s.scene.add(povLine); s.simPOVOrbitLine = povLine
      }
      if (partnerObj) {
        const partLine = makeOrbitLine(partnerObj.orbitRadius, partnerObj.tilt, 0x555555, 0.18, true)
        s.scene.add(partLine); s.simPartnerOrbitLine = partLine
      }

      // Red line between objects
      const redLine = makeSolidLine(0xff2040)
      s.scene.add(redLine); s.simRedLine = redLine

      // Green arc + arrows (for controllable POV sats)
      const arc = makeGreenArcLine(65)
      arc.visible = s.simFocusControllable
      s.scene.add(arc); s.simGreenArc = arc

      s.simArrows = []
      for (let i = 0; i < 7; i++) {
        const cone = makeArrow()
        cone.visible = s.simFocusControllable
        s.scene.add(cone); s.simArrows.push(cone)
      }

      // Hide normal orbit lines during sim (grey sim lines replace them)
      Object.entries(s.orbitLines).forEach(([, line]) => { if (line) line.visible = false })

      setFocusSatId(focusId)
    } else {
      // Exit sim mode
      if (s.simPhase === 'active' || s.simPhase === 'entering') {
        s.simExitCamStart = s.camera.position.clone()
        s.simExitTargetStart = s.controls.target.clone()
        s.simLerpT = 0
        s.simPhase = 'exiting'
      }

      // Remove sim objects
      ;[s.simTrackingRing, s.simPOVOrbitLine, s.simPartnerOrbitLine, s.simRedLine, s.simGreenArc, ...s.simArrows].forEach(obj => {
        if (obj) s.scene.remove(obj)
      })
      s.simTrackingRing = null; s.simPOVOrbitLine = null; s.simPartnerOrbitLine = null
      s.simRedLine = null; s.simGreenArc = null; s.simArrows = []
      s.simFocusId = null; s.simPartnerFocusId = null

      // Restore normal orbit line visibility (based on layers)
      Object.entries(s.orbitLines).forEach(([key, line]) => {
        if (!line) return
        if (key.endsWith('_label')) { line.visible = true; return }
        line.visible = true
      })
      setFocusSatId(null)
    }
  }, [simMode])

  // ── POV toggle (switch which sat the camera follows) ───────────────
  const handleTogglePOV = useCallback(() => {
    const s = stateRef.current
    if (!s.simFocusId || !s.simPartnerFocusId) return
    const newFocus = s.simFocusId === simMode?.satAId ? simMode?.satBId : simMode?.satAId
    const newPartner = newFocus === simMode?.satAId ? simMode?.satBId : simMode?.satAId

    // Remove old sim orbit lines and add new ones
    if (s.simPOVOrbitLine) s.scene.remove(s.simPOVOrbitLine)
    if (s.simPartnerOrbitLine) s.scene.remove(s.simPartnerOrbitLine)

    s.simFocusId = newFocus
    s.simPartnerFocusId = newPartner
    s.simFocusControllable = satellites?.find(sv => sv.id === newFocus)?.controllable ?? false

    const focusObj = s.sats[newFocus]
    const partnerObj = s.sats[newPartner]
    if (focusObj) {
      const l = makeOrbitLine(focusObj.orbitRadius, focusObj.tilt, 0xaaaaaa, 0.25, true)
      s.scene.add(l); s.simPOVOrbitLine = l
    }
    if (partnerObj) {
      const l = makeOrbitLine(partnerObj.orbitRadius, partnerObj.tilt, 0x555555, 0.18, true)
      s.scene.add(l); s.simPartnerOrbitLine = l
    }

    // Re-enter camera transition to new focus
    s.simEnterCamStart = s.camera.position.clone()
    s.simEnterTargetStart = s.controls.target.clone()
    s.simLerpT = 0
    s.simPhase = 'entering'

    setFocusSatId(newFocus)
  }, [simMode, satellites])

  // ── Kessler visual ─────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (!kesslerMode || !s.scene) return

    // Clear existing effects
    s.kesslerEffects.forEach(fx => s.scene.remove(fx.mesh))
    s.kesslerEffects = []

    // Spawn explosions at satellite positions, staggered in time
    const spawnExplosion = (pos, delay, isCascade = false) => {
      setTimeout(() => {
        if (!s.scene) return
        // Flash sphere
        const flash = makeKesslerFlash(pos.clone())
        flash.material.color.set(isCascade ? 0xff6600 : 0xffffff)
        s.scene.add(flash)
        s.kesslerEffects.push({ type: 'flash', mesh: flash, age: 0, duration: 1.2 })

        // Expanding ring
        const ring = makeKesslerRing(pos.clone())
        ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
        s.scene.add(ring)
        s.kesslerEffects.push({ type: 'ring', mesh: ring, age: 0, duration: 2.5 })

        // Second ring offset
        const ring2 = makeKesslerRing(pos.clone())
        ring2.rotation.set(Math.random() * Math.PI + 0.5, Math.random() * Math.PI, 0)
        ring2.material.color.set(0xff8800)
        s.scene.add(ring2)
        s.kesslerEffects.push({ type: 'debris', mesh: ring2, age: 0, duration: 3.5 })
      }, delay)
    }

    // Primary collision
    const sat1 = s.sats['SAT-001']
    const sat2 = s.sats['SAT-002']
    const p1 = sat1?.mesh.position ?? new THREE.Vector3(3.5, 0.5, 1)
    const p2 = sat2?.mesh.position ?? new THREE.Vector3(3.2, 1.0, 1.2)
    const midpoint = p1.clone().lerp(p2, 0.5)

    spawnExplosion(midpoint, 0)

    // Secondary cascade explosions at various orbital positions (simulating debris impacts)
    const cascadePositions = [
      new THREE.Vector3(4.0, 1.2, 0.5),
      new THREE.Vector3(-3.5, 0.8, 1.0),
      new THREE.Vector3(2.0, -1.5, 3.0),
      new THREE.Vector3(-2.8, 1.8, -1.5),
      new THREE.Vector3(3.8, -0.5, -2.0),
      new THREE.Vector3(-1.5, 2.0, 2.5),
    ]

    cascadePositions.forEach((pos, i) => {
      spawnExplosion(pos, 800 + i * 400, true)
    })

  }, [kesslerMode])

  // ── Settings sync ──────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    s.paused = paused
    if (s.controls && s.simPhase === null) s.controls.autoRotate = !paused
  }, [paused])

  useEffect(() => {
    if (stateRef.current.controls) stateRef.current.controls.rotateSpeed = sensitivity * (invertX ? -1 : 1)
  }, [sensitivity, invertX])

  useEffect(() => { stateRef.current.simSpeed = simSpeed }, [simSpeed])

  // ── Layers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (s.simPhase !== null) return // Don't fight sim mode visibility
    Object.entries(s.orbitLines).forEach(([key, obj]) => {
      if (!obj) return
      if (key.endsWith('_label')) {
        obj.visible = layers.sats[key.replace('_label', '')] !== false
      } else {
        obj.visible = layers.orbitRings && layers.sats[key] !== false
      }
    })
    Object.entries(s.sats).forEach(([satId, obj]) => {
      if (obj) obj.mesh.visible = layers.sats[satId] !== false
    })
    Object.entries(s.conjLines).forEach(([, line]) => {
      if (line) line.visible = layers.conjTiers[line._tier] !== false
    })
  }, [layers])

  // ── Click handler ──────────────────────────────────────────────────
  const handleClick = useCallback((e) => {
    const s = stateRef.current
    if (!s.scene || !s.camera || s.dragDist > 4) return
    const el = mountRef.current
    const rect = el.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, s.camera)
    const meshes = Object.values(s.sats).filter(o => o?.mesh.visible).map(o => o.mesh)
    const hits = raycaster.intersectObjects(meshes, true)
    if (hits.length > 0) {
      const hit = hits[0].object
      const satId = Object.keys(s.sats).find(id => {
        const obj = s.sats[id]
        return obj && (obj.mesh === hit || obj.mesh.children.some(c => c === hit))
      })
      if (satId) { setSelectedSatId(p => p === satId ? null : satId); return }
    }
    setSelectedSatId(null)
    if (!simMode) setActivePanel(null)
  }, [simMode])

  const handleToggleLayer = useCallback((key) => {
    setLayers(prev => {
      if (key === 'orbitRings') return { ...prev, orbitRings: !prev.orbitRings }
      if (key.startsWith('sat_')) return { ...prev, sats: { ...prev.sats, [key.slice(4)]: prev.sats[key.slice(4)] === false } }
      if (key.startsWith('tier_')) return { ...prev, conjTiers: { ...prev.conjTiers, [key.slice(5)]: !prev.conjTiers[key.slice(5)] } }
      return prev
    })
  }, [])

  const handleShowAll = useCallback(() => {
    setLayers(prev => ({
      orbitRings: true,
      sats: Object.fromEntries(Object.keys(prev.sats).map(id => [id, true])),
      conjTiers: { CRITICAL: true, HIGH: true, MEDIUM: true, LOW: true },
    }))
  }, [])

  const selectedSat = satellites?.find(s => s.id === selectedSatId)
  const focusSatData = satellites?.find(s => s.id === focusSatId)
  const partnerSatData = satellites?.find(s => {
    const s2 = stateRef.current
    return s.id === s2.simPartnerFocusId
  })

  const hudBtnStyle = (active) => ({
    padding: '5px 10px',
    background: active ? 'rgba(94,170,187,0.12)' : 'rgba(5,10,20,0.88)',
    border: `1px solid ${active ? 'rgba(94,170,187,0.45)' : 'rgba(30,58,95,0.75)'}`,
    borderRadius: '4px', color: active ? '#5eaabb' : '#475569',
    fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
    cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.15s', whiteSpace: 'nowrap',
  })

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300 }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} onClick={handleClick} />

      {/* Label */}
      {!simMode && (
        <div style={{
          position: 'absolute', top: 12, left: 14, fontSize: '9px',
          color: 'var(--text-tertiary)', letterSpacing: '0.14em',
          fontFamily: 'var(--font-display)', fontWeight: '500', pointerEvents: 'none',
        }}>ORBITAL VISUALIZATION</div>
      )}

      {/* Sim mode label */}
      {simMode && (
        <div style={{
          position: 'absolute', top: 12, left: 14,
          fontSize: '9px', color: '#5eaabb', letterSpacing: '0.14em',
          fontFamily: 'var(--font-display)', fontWeight: '600', pointerEvents: 'none',
        }}>
          ◉ SIMULATION MODE — {focusSatData?.name ?? focusSatId}
        </div>
      )}

      {/* HUD bar — top right */}
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: '5px' }}>
        <button style={hudBtnStyle(activePanel === 'layers')} onClick={() => setActivePanel(p => p === 'layers' ? null : 'layers')}>☰ LAYERS</button>
        <button style={hudBtnStyle(activePanel === 'settings')} onClick={() => setActivePanel(p => p === 'settings' ? null : 'settings')}>⚙ SETTINGS</button>
        <button style={hudBtnStyle(paused)} onClick={() => setPaused(p => !p)}>{paused ? '▶ RESUME' : '⏸ PAUSE'}</button>
      </div>

      {/* Panels */}
      {activePanel === 'layers' && <LayersPanel satellites={satellites ?? []} events={events ?? []} layers={layers} onToggle={handleToggleLayer} onShowAll={handleShowAll} />}
      {activePanel === 'settings' && <SettingsPanel sensitivity={sensitivity} onSensitivity={setSensitivity} simSpeed={simSpeed} onSimSpeed={setSimSpeed} invertY={invertY} onInvertY={() => setInvertY(p => !p)} invertX={invertX} onInvertX={() => setInvertX(p => !p)} />}

      {/* Satellite popup */}
      {selectedSat && <SatDetailPopup sat={selectedSat} events={events} onClose={() => setSelectedSatId(null)} />}

      {/* ── Sim mode bottom controls ───────────────────────────────── */}
      {simMode && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '8px', alignItems: 'center',
        }}>
          {/* POV toggle */}
          <button
            onClick={handleTogglePOV}
            style={{
              padding: '6px 14px', borderRadius: '4px', cursor: 'pointer',
              background: 'rgba(5,10,20,0.9)', border: '1px solid rgba(94,170,187,0.5)',
              color: '#5eaabb', fontSize: '11px', fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em', backdropFilter: 'blur(10px)',
            }}
          >
            ◁ {focusSatData?.name ?? focusSatId} ▷
          </button>

          {/* End sim */}
          <button
            onClick={onEndSim}
            style={{
              padding: '6px 14px', borderRadius: '4px', cursor: 'pointer',
              background: 'rgba(160,40,50,0.2)', border: '1px solid rgba(248,113,113,0.5)',
              color: '#f87171', fontSize: '11px', fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em', backdropFilter: 'blur(10px)',
            }}
          >
            ✕ END SIM
          </button>
        </div>
      )}

      {/* ── Sim legend ─────────────────────────────────────────────── */}
      {simMode && (
        <div style={{
          position: 'absolute', bottom: 16, right: 10,
          display: 'flex', flexDirection: 'column', gap: '4px',
          fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#475569',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '1px', background: '#ff2040' }} />
            <span>Separation</span>
          </div>
          {stateRef.current.simFocusControllable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '16px', height: '2px', background: '#4ade80', borderTop: '1px dashed #4ade80' }} />
              <span>Maneuver arc</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '1px', borderTop: '1px dashed #aaaaaa' }} />
            <span>POV orbit</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '1px', borderTop: '1px dashed #555555' }} />
            <span>Partner orbit</span>
          </div>
        </div>
      )}

      {/* ── Kessler warning banner ─────────────────────────────────── */}
      {kesslerMode && (
        <div style={{
          position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
          padding: '6px 18px', borderRadius: '4px',
          background: 'rgba(160,40,40,0.25)', border: '1px solid rgba(248,113,113,0.5)',
          color: '#f87171', fontSize: '10px', fontFamily: 'var(--font-mono)',
          letterSpacing: '0.12em', fontWeight: '600', backdropFilter: 'blur(8px)',
          animation: 'pulse 1.2s ease-in-out infinite', pointerEvents: 'none',
        }}>
          ⚠ KESSLER CASCADE IN PROGRESS
        </div>
      )}

      {/* Avoidance flash */}
      {status === 'AVOIDED' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          padding: '14px 28px', borderRadius: 'var(--radius-md)',
          fontSize: '14px', fontWeight: '600', letterSpacing: '0.12em',
          fontFamily: 'var(--font-display)', color: 'var(--status-ok)',
          background: 'rgba(13,18,25,0.9)', border: '1px solid var(--border-subtle)',
          animation: 'fadeInOut 4s ease forwards', pointerEvents: 'none', backdropFilter: 'blur(8px)',
        }}>COLLISION AVOIDED</div>
      )}
    </div>
  )
}
