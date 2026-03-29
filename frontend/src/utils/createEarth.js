/**
 * Photorealistic 3D Earth using real satellite textures.
 *
 * Uses:
 *   - /planet-earth/tierra1.jpg         (2048x1024 color map)
 *   - /planet-earth/2k_earth_clouds.jpg (2048x1024 cloud layer)
 *   - Fresnel atmosphere glow (custom GLSL shader)
 *   - Night-side city lights (procedural emissive)
 */

import * as THREE from 'three'

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

// ─── Procedural night lights (no texture needed) ─────────────────────

function generateNightLights() {
  const W = 1024, H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  const d = img.data

  // Simple hash noise for city light clusters
  const hash = (x, y, z) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
    return n - Math.floor(n)
  }
  const smoothNoise = (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
    let fx = x - ix, fy = y - iy, fz = z - iz
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz)
    const c000 = hash(ix,iy,iz), c100 = hash(ix+1,iy,iz), c010 = hash(ix,iy+1,iz), c110 = hash(ix+1,iy+1,iz)
    const c001 = hash(ix,iy,iz+1), c101 = hash(ix+1,iy,iz+1), c011 = hash(ix,iy+1,iz+1), c111 = hash(ix+1,iy+1,iz+1)
    const x0 = c000 + (c100-c000)*fx, x1 = c010 + (c110-c010)*fx
    const x2 = c001 + (c101-c001)*fx, x3 = c011 + (c111-c011)*fx
    return (x0 + (x1-x0)*fy) + ((x2 + (x3-x2)*fy) - (x0 + (x1-x0)*fy)) * fz
  }
  const fbm = (x, y, z) => {
    let v = 0, a = 0.5, f = 1
    for (let i = 0; i < 4; i++) { v += a * smoothNoise(x*f, y*f, z*f); a *= 0.5; f *= 2 }
    return v
  }

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const lon = (px / W) * Math.PI * 2 - Math.PI
      const lat = (py / H) * Math.PI
      const nx = Math.sin(lat) * Math.cos(lon)
      const ny = Math.cos(lat)
      const nz = Math.sin(lat) * Math.sin(lon)
      const latDeg = 90 - (lat / Math.PI) * 180

      let brightness = 0
      const polar = Math.abs(latDeg) / 90
      if (polar < 0.72) {
        const cn = fbm(nx * 8 + 50, ny * 8 + 50, nz * 8 + 50)
        if (cn > 0.52) brightness = ((cn - 0.52) / 0.48) * 0.5
      }

      const v = Math.floor(brightness * 255)
      const i = (py * W + px) * 4
      d[i] = v; d[i+1] = Math.floor(v * 0.82); d[i+2] = Math.floor(v * 0.35); d[i+3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

// ─── Texture Cache ───────────────────────────────────────────────────

let _cache = null

function getTextures() {
  if (_cache) return _cache

  const loader = new THREE.TextureLoader()

  // Real satellite textures
  const color = loader.load('/planet-earth/tierra1.jpg')
  color.colorSpace = THREE.SRGBColorSpace
  color.anisotropy = 8

  const clouds = loader.load('/planet-earth/2k_earth_clouds.jpg')
  clouds.anisotropy = 4

  // Procedural night lights (small, fast)
  const nightCanvas = generateNightLights()
  const nightLight = new THREE.CanvasTexture(nightCanvas)
  nightLight.anisotropy = 4

  _cache = { color, clouds, nightLight }
  return _cache
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Build a photorealistic Earth group.
 * @param {{ radius?: number, segments?: number }} opts
 * @returns {{ group: THREE.Group, update: (elapsed: number) => void }}
 */
export function createEarth({ radius = 2.5, segments = 64 } = {}) {
  const group = new THREE.Group()
  const tex = getTextures()

  // ── Lighting ──
  const sun = new THREE.DirectionalLight(0xffffff, 2.0)
  sun.position.set(5, 3, 5)
  group.add(sun)
  group.add(sun.target)

  group.add(new THREE.AmbientLight(0x0a1830, 0.35))

  // ── Earth mesh — real texture ──
  const earthGeo = new THREE.SphereGeometry(radius, segments, segments)
  const earthMat = new THREE.MeshPhongMaterial({
    map: tex.color,
    bumpMap: tex.color,          // use color as subtle bump
    bumpScale: 0.02 * radius,
    specular: new THREE.Color(0x333333),
    shininess: 25,
    emissiveMap: tex.nightLight,
    emissive: new THREE.Color(0xffaa44),
    emissiveIntensity: 0.45,
  })
  const earthMesh = new THREE.Mesh(earthGeo, earthMat)
  group.add(earthMesh)

  // ── Cloud layer — real texture ──
  const cloudGeo = new THREE.SphereGeometry(radius * 1.008, segments / 2, segments / 2)
  const cloudMat = new THREE.MeshPhongMaterial({
    map: tex.clouds,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat)
  group.add(cloudMesh)

  // ── Atmosphere — outer glow (BackSide Fresnel) ──
  const outerGeo = new THREE.SphereGeometry(radius * 1.16, 48, 48)
  const outerMat = new THREE.ShaderMaterial({
    vertexShader: ATM_VERT,
    fragmentShader: ATM_FRAG,
    uniforms: {
      glowColor: { value: new THREE.Color(0x4090c0) },
      coeff: { value: 0.6 },
      power: { value: 5.0 },
    },
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
  group.add(new THREE.Mesh(outerGeo, outerMat))

  // ── Atmosphere — inner rim glow ──
  const innerGeo = new THREE.SphereGeometry(radius * 1.02, 48, 48)
  const innerMat = new THREE.ShaderMaterial({
    vertexShader: ATM_VERT,
    fragmentShader: ATM_FRAG,
    uniforms: {
      glowColor: { value: new THREE.Color(0x4090c0) },
      coeff: { value: 0.3 },
      power: { value: 2.5 },
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
