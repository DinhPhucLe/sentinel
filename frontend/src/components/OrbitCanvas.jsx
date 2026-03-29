import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createEarth } from '../utils/createEarth'

const EARTH_RADIUS = 2.5

// Graduated altitude mapping for 50-object dataset (420–960 km LEO range)
function altToRadius(alt) {
  if (alt > 10000) return EARTH_RADIUS + 3.0   // MEO/GEO
  if (alt > 1000)  return EARTH_RADIUS + 1.8   // upper LEO
  if (alt > 850)   return EARTH_RADIUS + 1.5   // high LEO (SSO ~850-960 km)
  if (alt > 700)   return EARTH_RADIUS + 1.2   // mid LEO (SSO ~700-850 km)
  if (alt > 550)   return EARTH_RADIUS + 1.0   // low-mid LEO (550-700 km)
  if (alt > 400)   return EARTH_RADIUS + 0.8   // low LEO (ISS/HST ~400-550 km)
  return EARTH_RADIUS + 0.6                     // very low LEO
}

const SAT_COLORS = {
  GPS: 0x00C8F0, STARLINK: 0x90B0C0, ISS: 0xF0D060, DEBRIS: 0x505860,
  JAXA: 0x00B4E0, ROSCOSMOS: 0xE07040, CNSA: 0xE04040,
  ESA: 0x4488FF, NASA: 0xFFA020, NOAA: 0x20C890,
  US: 0x7090A0, GER: 0x80B060, CHLE: 0xC0A050, UNKNOWN: 0x606870,
}
const SAT_HEX = {
  GPS: '#00C8F0', STARLINK: '#90B0C0', ISS: '#F0D060', DEBRIS: '#505860',
  JAXA: '#00B4E0', ROSCOSMOS: '#E07040', CNSA: '#E04040',
  ESA: '#4488FF', NASA: '#FFA020', NOAA: '#20C890',
  US: '#7090A0', GER: '#80B060', CHLE: '#C0A050', UNKNOWN: '#606870',
}

// Absolute 10x-step thresholds based on NORAD operational standards (not data-fitted)
// 0.01% = mandatory review threshold; 0.1% = serious concern; 1% = critical emergency
const CONJ_TIERS = [
  { key: 'CRITICAL', label: 'CRITICAL', color: '#f87171', test: p => p >= 0.01 },                // ≥1%
  { key: 'HIGH',     label: 'HIGH',     color: '#fb923c', test: p => p >= 0.001 && p < 0.01 },   // 0.1–1%
  { key: 'MEDIUM',   label: 'MEDIUM',   color: '#fbbf24', test: p => p >= 0.0001 && p < 0.001 }, // 0.01–0.1%
  { key: 'LOW',      label: 'LOW',      color: '#34d399', test: p => p < 0.0001 },               // <0.01%
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

const AGENT_META_CANVAS = {
  tracking_agent:     { color: '#5eaabb', label: 'TRK' },
  prediction_agent:   { color: '#a78bfa', label: 'PRED' },
  optimization_agent: { color: '#fbbf24', label: 'OPT' },
  negotiation_agent:  { color: '#fb923c', label: 'NEG' },
  governance_agent:   { color: '#34d399', label: 'GOV' },
  system:             { color: '#f87171', label: 'SYS' },
}

export default function OrbitCanvas({ satellites, events, decision, status, simMode, agentMessages, layerOverrides, onEndSim }) {
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
    s.camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 2000)
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

    // ── Deep-space background sphere ──
    const bgGeo = new THREE.SphereGeometry(900, 64, 64)
    const bgCanvas = document.createElement('canvas')
    bgCanvas.width = 2048; bgCanvas.height = 1024
    const bgCtx = bgCanvas.getContext('2d')
    // Base dark space
    bgCtx.fillStyle = '#030610'
    bgCtx.fillRect(0, 0, 2048, 1024)
    // Soft nebula / galaxy clouds — very subtle
    const nebulaSpots = [
      { x: 500, y: 350, r: 320, color: 'rgba(15,25,60,0.18)' },
      { x: 1400, y: 500, r: 400, color: 'rgba(30,15,45,0.12)' },
      { x: 1800, y: 200, r: 220, color: 'rgba(12,30,50,0.10)' },
      { x: 300, y: 750, r: 260, color: 'rgba(20,12,40,0.08)' },
      { x: 1000, y: 150, r: 300, color: 'rgba(10,20,45,0.10)' },
    ]
    nebulaSpots.forEach(n => {
      const ng = bgCtx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r)
      ng.addColorStop(0, n.color)
      ng.addColorStop(0.6, n.color.replace(/[\d.]+\)$/, '0.03)'))
      ng.addColorStop(1, 'transparent')
      bgCtx.fillStyle = ng
      bgCtx.fillRect(0, 0, 2048, 1024)
    })
    // Milky-way band — very faint diagonal glow
    bgCtx.save()
    bgCtx.translate(1024, 512)
    bgCtx.rotate(-0.25)
    const mwGrad = bgCtx.createLinearGradient(0, -80, 0, 80)
    mwGrad.addColorStop(0, 'transparent')
    mwGrad.addColorStop(0.3, 'rgba(200,210,230,0.02)')
    mwGrad.addColorStop(0.5, 'rgba(220,225,240,0.04)')
    mwGrad.addColorStop(0.7, 'rgba(200,210,230,0.02)')
    mwGrad.addColorStop(1, 'transparent')
    bgCtx.fillStyle = mwGrad
    bgCtx.fillRect(-1200, -80, 2400, 160)
    bgCtx.restore()
    // Baked stars — white/cream only, small and subtle
    for (let i = 0; i < 3000; i++) {
      const sx = Math.random() * 2048, sy = Math.random() * 1024
      const brightness = Math.random()
      const sr = brightness > 0.97 ? 1.2 : brightness > 0.85 ? 0.7 : 0.4
      const alpha = 0.2 + brightness * 0.5
      // White to warm cream only
      const warm = Math.random()
      const starColor = warm < 0.7
        ? `rgba(240,242,255,${alpha})`
        : `rgba(255,248,235,${alpha})`
      bgCtx.beginPath()
      bgCtx.arc(sx, sy, sr, 0, Math.PI * 2)
      bgCtx.fillStyle = starColor
      bgCtx.fill()
    }
    const bgTex = new THREE.CanvasTexture(bgCanvas)
    bgTex.colorSpace = THREE.SRGBColorSpace
    const bgMat = new THREE.MeshBasicMaterial({ map: bgTex, side: THREE.BackSide })
    const bgMesh = new THREE.Mesh(bgGeo, bgMat)
    s.scene.add(bgMesh)
    s.bgMesh = bgMesh

    // ── 3D star particles — white/cream, gentle twinkle ──
    const starVertShader = `
      attribute float aSize;
      attribute float aPhase;
      varying float vPhase;
      uniform float uTime;
      void main() {
        vPhase = aPhase;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (120.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `
    const starFragShader = `
      varying float vPhase;
      uniform float uTime;
      uniform vec3 uColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float glow = exp(-d * 3.5);
        float twinkle = 0.8 + 0.2 * sin(uTime * 1.2 + vPhase * 6.2831);
        gl_FragColor = vec4(uColor, glow * twinkle * 0.6);
      }
    `
    const makeStarLayer = (count, spread, baseSize, color) => {
      const pos = new Float32Array(count * 3)
      const sizes = new Float32Array(count)
      const phases = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        pos[i*3]   = (Math.random() - 0.5) * spread
        pos[i*3+1] = (Math.random() - 0.5) * spread
        pos[i*3+2] = (Math.random() - 0.5) * spread
        sizes[i] = baseSize * (0.4 + Math.random() * 1.0)
        phases[i] = Math.random()
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
      geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1))
      const mat = new THREE.ShaderMaterial({
        vertexShader: starVertShader, fragmentShader: starFragShader,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      })
      const pts = new THREE.Points(geo, mat)
      s.scene.add(pts)
      return pts
    }
    // Small white stars
    s.stars = makeStarLayer(3000, 500, 1.0, 0xeeeeff)
    // Dim cream dust
    s.starsWarm = makeStarLayer(2000, 600, 0.6, 0xfff8e8)

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
      // Rotate background sphere slowly
      if (s.bgMesh) { s.bgMesh.rotation.y = t * 0.001 }
      // Update star shader time + gentle rotation
      ;[s.stars, s.starsWarm].forEach((layer, i) => {
        if (!layer) return
        layer.material.uniforms.uTime.value = t
        layer.rotation.y = t * (0.002 + i * 0.0005)
        layer.rotation.x = t * (0.001 + i * 0.0003)
      })

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
        s.camera.position.lerpVectors(s.simExitCamStart, new THREE.Vector3(0, 7, 14), ease)
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

    satellites.forEach((sat, i) => {
      const color = SAT_COLORS[sat.operator] || SAT_COLORS.UNKNOWN
      const radius = altToRadius(sat.altitude_km)
      // Use real inclination (degrees → radians) for orbital plane tilt
      const tilt = (sat.inclination ?? 0) * Math.PI / 180
      // Golden-angle spread gives uniform distribution for any satellite count
      const angleOffset = (i * 2.39996) % (2 * Math.PI)

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
        speed: 0.3 / (radius / EARTH_RADIUS), tilt, angleOffset,
        isAvoiding: false, currentRadius: radius,
        operator: sat.operator, controllable: sat.controllable,
      }
    })

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

      // Restore everything — all objects, orbit rings, conjunction lines
      Object.values(s.orbitLines).forEach(line => { if (line) line.visible = true })
      Object.values(s.sats).forEach(obj => { if (obj) obj.mesh.visible = true })
      Object.values(s.conjLines).forEach(line => {
        if (line) { line.visible = true; line.material.opacity = 0.6 }
      })
      // Reset layer toggles so UI reflects the restored state
      setLayers(prev => ({
        ...prev,
        orbitRings: true,
        conjTiers: { CRITICAL: true, HIGH: true, MEDIUM: true, LOW: true },
      }))
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

  // ── External layer overrides (from chat assistant) ─────────────────
  useEffect(() => {
    if (!layerOverrides?.length) return
    const { layer, visible } = layerOverrides[layerOverrides.length - 1]
    setLayers(prev => {
      if (layer === 'orbitRings') return { ...prev, orbitRings: visible }
      if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(layer))
        return { ...prev, conjTiers: { ...prev.conjTiers, [layer]: visible } }
      return prev
    })
  }, [layerOverrides?.length])

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

      {/* Zoom + Home controls — bottom right */}
      <div style={{
        position: 'absolute', bottom: simMode ? 60 : 16, right: 10,
        display: 'flex', flexDirection: 'column', gap: '3px',
      }}>
        <button
          style={{ ...hudBtnStyle(false), padding: '4px 8px', fontSize: '12px', lineHeight: 1, fontWeight: '700', width: '30px', textAlign: 'center' }}
          onClick={() => {
            const s = stateRef.current
            if (!s.controls || !s.camera) return
            const dir = new THREE.Vector3().subVectors(s.camera.position, s.controls.target).normalize()
            const dist = s.camera.position.distanceTo(s.controls.target)
            const newDist = Math.max(s.controls.minDistance, dist * 0.8)
            s.camera.position.copy(s.controls.target).addScaledVector(dir, newDist)
            s.controls.update()
          }}
          title="Zoom In"
        >+</button>
        <button
          style={{ ...hudBtnStyle(false), padding: '4px 8px', fontSize: '12px', lineHeight: 1, fontWeight: '700', width: '30px', textAlign: 'center' }}
          onClick={() => {
            const s = stateRef.current
            if (!s.controls || !s.camera) return
            const dir = new THREE.Vector3().subVectors(s.camera.position, s.controls.target).normalize()
            const dist = s.camera.position.distanceTo(s.controls.target)
            const newDist = Math.min(s.controls.maxDistance, dist * 1.25)
            s.camera.position.copy(s.controls.target).addScaledVector(dir, newDist)
            s.controls.update()
          }}
          title="Zoom Out"
        >−</button>
        <button
          style={{ ...hudBtnStyle(false), padding: '4px 8px', fontSize: '9px', lineHeight: 1, fontWeight: '600', width: '30px', textAlign: 'center', letterSpacing: '0.04em' }}
          onClick={() => {
            const s = stateRef.current
            if (!s.controls || !s.camera) return
            s.camera.position.set(0, 5, 10)
            s.controls.target.set(0, 0, 0)
            s.controls.update()
          }}
          title="Reset View"
        >⌂</button>
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

      {/* ── Agent activity feed overlay ─────────────────────────────── */}
      {agentMessages?.length > 0 && (
        <div style={{
          position: 'absolute', top: simMode ? 34 : 30, left: 14,
          display: 'flex', flexDirection: 'column', gap: '2px',
          maxWidth: '260px', pointerEvents: 'none',
        }}>
          {agentMessages.slice(-3).map((msg, i) => {
            const meta = AGENT_META_CANVAS[msg.agent] ?? { color: '#475569', label: (msg.agent ?? '?').slice(0, 4).toUpperCase() }
            const firstLine = msg.message?.split('\n')[0]?.trim() ?? ''
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '3px 8px',
                background: 'rgba(5,10,20,0.78)',
                borderLeft: `2px solid ${meta.color}`,
                borderRadius: '0 3px 3px 0',
                backdropFilter: 'blur(6px)',
              }}>
                <span style={{
                  color: meta.color, fontSize: '8px', fontWeight: '700',
                  letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', flexShrink: 0,
                }}>{meta.label}</span>
                <span style={{
                  color: '#475569', fontSize: '8px', fontFamily: 'var(--font-mono)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{firstLine.slice(0, 38)}</span>
              </div>
            )
          })}
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
