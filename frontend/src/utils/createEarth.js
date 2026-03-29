/**
 * Photorealistic 3D Earth — real satellite textures, bright, no blue glow.
 */

import * as THREE from 'three'

// ─── Texture Cache ───────────────────────────────────────────────────

let _cache = null

function getTextures() {
  if (_cache) return _cache
  const loader = new THREE.TextureLoader()

  const color = loader.load('/planet-earth/textures/tierra1.jpg')
  color.colorSpace = THREE.SRGBColorSpace
  color.anisotropy = 8

  const clouds = loader.load('/planet-earth/textures/2k_earth_clouds.jpg')
  clouds.anisotropy = 4

  _cache = { color, clouds }
  return _cache
}

// ─── Public API ──────────────────────────────────────────────────────

export function createEarth({ radius = 2.5, segments = 64 } = {}) {
  const group = new THREE.Group()
  const tex = getTextures()

  // ── Lighting — bright from camera-facing direction ──
  const sun = new THREE.DirectionalLight(0xffffff, 3.0)
  sun.position.set(3, 2, 5)  // towards the viewer so the visible face is lit
  group.add(sun)
  group.add(sun.target)

  // Strong ambient so dark side is still visible
  group.add(new THREE.AmbientLight(0x667788, 1.5))

  // Fill light from the other side
  const fill = new THREE.DirectionalLight(0x8899aa, 0.8)
  fill.position.set(-4, -1, -3)
  group.add(fill)

  // ── Earth mesh ──
  const earthGeo = new THREE.SphereGeometry(radius, segments, segments)
  const earthMat = new THREE.MeshPhongMaterial({
    map: tex.color,
    bumpMap: tex.color,
    bumpScale: 0.015 * radius,
    specular: new THREE.Color(0x222222),
    shininess: 12,
  })
  const earthMesh = new THREE.Mesh(earthGeo, earthMat)
  group.add(earthMesh)

  // ── Cloud layer ──
  const cloudGeo = new THREE.SphereGeometry(radius * 1.005, segments / 2, segments / 2)
  const cloudMat = new THREE.MeshPhongMaterial({
    map: tex.clouds,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat)
  group.add(cloudMesh)

  // NO atmosphere glow — clean, professional look

  // ── Animation ──
  function update(elapsed) {
    earthMesh.rotation.y = elapsed * 0.025
    cloudMesh.rotation.y = elapsed * 0.032
  }

  return { group, update, earthMesh, cloudMesh }
}
