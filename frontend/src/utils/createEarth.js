/**
 * Procedural 3D Earth — no external textures needed.
 *
 * Creates a realistic Earth with:
 *   - Procedural continent/ocean color map (3D noise + continent bias)
 *   - Bump map for terrain relief
 *   - Specular map (shiny ocean, matte land)
 *   - Night-side city lights (emissive)
 *   - Semi-transparent cloud layer
 *   - Fresnel atmosphere glow (custom shader)
 */

import * as THREE from 'three'

// ─── 3D Value Noise ──────────────────────────────────────────────────

function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return n - Math.floor(n)
}

function smoothNoise3D(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  let fx = x - ix, fy = y - iy, fz = z - iz
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  fz = fz * fz * (3 - 2 * fz)

  const c000 = hash3(ix, iy, iz),     c100 = hash3(ix+1, iy, iz)
  const c010 = hash3(ix, iy+1, iz),   c110 = hash3(ix+1, iy+1, iz)
  const c001 = hash3(ix, iy, iz+1),   c101 = hash3(ix+1, iy, iz+1)
  const c011 = hash3(ix, iy+1, iz+1), c111 = hash3(ix+1, iy+1, iz+1)

  const x0 = c000 + (c100 - c000) * fx
  const x1 = c010 + (c110 - c010) * fx
  const x2 = c001 + (c101 - c001) * fx
  const x3 = c011 + (c111 - c011) * fx
  const y0 = x0 + (x1 - x0) * fy
  const y1 = x2 + (x3 - x2) * fy
  return y0 + (y1 - y0) * fz
}

function fbm(x, y, z, octaves) {
  let value = 0, amp = 0.5, freq = 1
  for (let i = 0; i < octaves; i++) {
    value += amp * smoothNoise3D(x * freq, y * freq, z * freq)
    amp *= 0.5
    freq *= 2
  }
  return value
}

// ─── Approximate Continent Regions ───────────────────────────────────
// [centerLon, centerLat, radiusLon, radiusLat, weight]

const CONTINENT_HINTS = [
  [-100, 48, 35, 25, 0.60],   // North America
  [-90,  28, 18, 10, 0.40],   // Central America
  [-58, -15, 22, 32, 0.55],   // South America
  [ 15,  50, 28, 16, 0.50],   // Europe
  [ 22,   5, 26, 32, 0.55],   // Africa
  [ 90,  48, 52, 26, 0.60],   // Asia
  [105,  12, 22, 16, 0.40],   // Southeast Asia
  [135, -25, 20, 15, 0.50],   // Australia
  [  0, -82, 180, 10, 0.70],  // Antarctica
]

function continentBias(lonDeg, latDeg) {
  let best = 0
  for (const [cLon, cLat, rLon, rLat, w] of CONTINENT_HINTS) {
    let dLon = Math.abs(lonDeg - cLon)
    if (dLon > 180) dLon = 360 - dLon
    const d = Math.sqrt((dLon / rLon) ** 2 + ((latDeg - cLat) / rLat) ** 2)
    if (d < 1) best = Math.max(best, w * (1 - d))
  }
  return best
}

// ─── Texture Generators ──────────────────────────────────────────────

const SEA_LEVEL = 0.38
const TEX_W = 1024
const TEX_H = 512

/** Equirectangular pixel → unit-sphere 3D coords */
function pixelToSphere(px, py, w, h) {
  const lon = (px / w) * Math.PI * 2 - Math.PI
  const lat = (py / h) * Math.PI           // 0=north pole, π=south pole
  return {
    nx: Math.sin(lat) * Math.cos(lon),
    ny: Math.cos(lat),
    nz: Math.sin(lat) * Math.sin(lon),
    lonDeg: (lon / Math.PI) * 180,
    latDeg: 90 - (lat / Math.PI) * 180,    // +90 north … –90 south
  }
}

function generateEarthTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W; canvas.height = TEX_H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(TEX_W, TEX_H)
  const d = img.data
  const elev = new Float32Array(TEX_W * TEX_H)

  for (let py = 0; py < TEX_H; py++) {
    for (let px = 0; px < TEX_W; px++) {
      const { nx, ny, nz, lonDeg, latDeg } = pixelToSphere(px, py, TEX_W, TEX_H)
      const bias = continentBias(lonDeg, latDeg)
      const n = fbm(nx * 2 + 3.7, ny * 2 + 1.3, nz * 2 + 0.5, 5)
      let e = n * 0.4 + n * bias * 0.6

      // Polar ice boost
      const polar = Math.abs(latDeg) / 90
      if (polar > 0.75) e += (polar - 0.75) * 2.0

      elev[py * TEX_W + px] = e

      let r, g, b
      if (e < SEA_LEVEL) {
        // Ocean — dark moody blue
        const depth = (SEA_LEVEL - e) / SEA_LEVEL
        r = 4  + (1 - depth) * 10
        g = 12 + (1 - depth) * 25
        b = 38 + (1 - depth) * 45
      } else if (polar > 0.72) {
        // Ice caps
        const s = Math.min(1, (polar - 0.72) / 0.22)
        r = 150 + s * 95;  g = 160 + s * 85;  b = 175 + s * 75
      } else {
        const h = (e - SEA_LEVEL) / (1 - SEA_LEVEL)
        if (h > 0.65) {
          // Mountains
          r = 55 + h * 50;  g = 50 + h * 40;  b = 38 + h * 30
        } else if (Math.abs(latDeg) < 25) {
          // Tropical
          r = 12 + h * 28;  g = 42 + h * 48;  b = 8 + h * 12
        } else {
          // Temperate
          r = 22 + h * 40;  g = 50 + h * 55;  b = 12 + h * 22
        }
      }

      const i = (py * TEX_W + px) * 4
      d[i] = r;  d[i+1] = g;  d[i+2] = b;  d[i+3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return { canvas, elev }
}

function generateBumpMap(elev) {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W; canvas.height = TEX_H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(TEX_W, TEX_H)
  const d = img.data
  for (let i = 0; i < elev.length; i++) {
    const v = Math.min(255, Math.max(0, Math.floor(elev[i] * 255)))
    d[i*4] = v; d[i*4+1] = v; d[i*4+2] = v; d[i*4+3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function generateSpecularMap(elev) {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W; canvas.height = TEX_H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(TEX_W, TEX_H)
  const d = img.data
  for (let i = 0; i < elev.length; i++) {
    const v = elev[i] < SEA_LEVEL ? 180 : 15
    d[i*4] = v; d[i*4+1] = v; d[i*4+2] = v; d[i*4+3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function generateNightLights(elev) {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W; canvas.height = TEX_H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(TEX_W, TEX_H)
  const d = img.data
  for (let py = 0; py < TEX_H; py++) {
    for (let px = 0; px < TEX_W; px++) {
      const idx = py * TEX_W + px
      const e = elev[idx]
      const { nx, ny, nz, latDeg } = pixelToSphere(px, py, TEX_W, TEX_H)
      const polar = Math.abs(latDeg) / 90
      let brightness = 0
      if (e > SEA_LEVEL && polar < 0.72) {
        const cn = fbm(nx * 8 + 50, ny * 8 + 50, nz * 8 + 50, 3)
        if (cn > 0.52) brightness = ((cn - 0.52) / 0.48) * 0.55
      }
      const v = Math.floor(brightness * 255)
      const i = idx * 4
      d[i] = v;  d[i+1] = Math.floor(v * 0.82);  d[i+2] = Math.floor(v * 0.35);  d[i+3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function generateClouds() {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W; canvas.height = TEX_H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(TEX_W, TEX_H)
  const d = img.data
  for (let py = 0; py < TEX_H; py++) {
    for (let px = 0; px < TEX_W; px++) {
      const { nx, ny, nz } = pixelToSphere(px, py, TEX_W, TEX_H)
      const n = fbm(nx * 3.5 + 10.5, ny * 3.5 + 20.3, nz * 3.5 + 15.7, 4)
      const cloud = Math.max(0, (n - 0.42) / 0.58)
      const i = (py * TEX_W + px) * 4
      d[i] = 255; d[i+1] = 255; d[i+2] = 255; d[i+3] = Math.floor(cloud * 160)
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

// ─── Atmosphere Shader ───────────────────────────────────────────────

const ATM_VERT = `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
  }
`

const ATM_FRAG = `
  uniform vec3 glowColor;
  uniform float coeff;
  uniform float power;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float f = 1.0 - dot(viewDir, vNormal);
    float intensity = coeff * pow(f, power);
    gl_FragColor = vec4(glowColor, intensity);
  }
`

// ─── Texture Cache (avoids regeneration on React re-mount) ──────────

let _cache = null

function getTextures() {
  if (_cache) return _cache
  const { canvas: colorCanvas, elev } = generateEarthTexture()

  const mk = (c) => {
    const t = new THREE.CanvasTexture(c)
    t.anisotropy = 4
    return t
  }

  _cache = {
    color:      mk(colorCanvas),
    bump:       mk(generateBumpMap(elev)),
    specular:   mk(generateSpecularMap(elev)),
    nightLight: mk(generateNightLights(elev)),
    cloud:      mk(generateClouds()),
  }
  return _cache
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Build a full Earth group.
 * @param {{ radius?: number, segments?: number }} opts
 * @returns {{ group: THREE.Group, update: (elapsed: number) => void }}
 */
export function createEarth({ radius = 2.5, segments = 64 } = {}) {
  const group = new THREE.Group()
  const tex = getTextures()

  // ── Lighting ──
  const sun = new THREE.DirectionalLight(0xffffff, 1.8)
  sun.position.set(5, 3, 5)
  group.add(sun)
  group.add(sun.target)  // keeps light relative to group

  group.add(new THREE.AmbientLight(0x0a1830, 0.4))

  // ── Earth mesh ──
  const earthGeo = new THREE.SphereGeometry(radius, segments, segments)
  const earthMat = new THREE.MeshPhongMaterial({
    map: tex.color,
    bumpMap: tex.bump,
    bumpScale: 0.04 * radius,
    specularMap: tex.specular,
    specular: new THREE.Color(0x555555),
    shininess: 35,
    emissiveMap: tex.nightLight,
    emissive: new THREE.Color(0xffaa44),
    emissiveIntensity: 0.5,
  })
  const earthMesh = new THREE.Mesh(earthGeo, earthMat)
  group.add(earthMesh)

  // ── Cloud layer ──
  const cloudGeo = new THREE.SphereGeometry(radius * 1.012, segments / 2, segments / 2)
  const cloudMat = new THREE.MeshPhongMaterial({
    map: tex.cloud,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat)
  group.add(cloudMesh)

  // ── Atmosphere — outer glow (BackSide Fresnel) ──
  const outerGeo = new THREE.SphereGeometry(radius * 1.18, 48, 48)
  const outerMat = new THREE.ShaderMaterial({
    vertexShader: ATM_VERT,
    fragmentShader: ATM_FRAG,
    uniforms: {
      glowColor: { value: new THREE.Color(0x38bdf8) },
      coeff: { value: 0.7 },
      power: { value: 5.0 },
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
  group.add(new THREE.Mesh(outerGeo, outerMat))

  // ── Atmosphere — inner rim glow (FrontSide Fresnel) ──
  const innerGeo = new THREE.SphereGeometry(radius * 1.025, 48, 48)
  const innerMat = new THREE.ShaderMaterial({
    vertexShader: ATM_VERT,
    fragmentShader: ATM_FRAG,
    uniforms: {
      glowColor: { value: new THREE.Color(0x38bdf8) },
      coeff: { value: 0.35 },
      power: { value: 2.8 },
    },
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
  group.add(new THREE.Mesh(innerGeo, innerMat))

  // ── Animation ──
  function update(elapsed) {
    earthMesh.rotation.y = elapsed * 0.025
    cloudMesh.rotation.y = elapsed * 0.032
  }

  return { group, update, earthMesh, cloudMesh }
}
