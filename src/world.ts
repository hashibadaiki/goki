import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { glowTexture, tileTexture } from './textures'

export type RoutePoint = { p: THREE.Vector2; pause: number }

export interface World {
  root: THREE.Group
  colliders: THREE.Object3D[]
  crumbs: THREE.Vector3[]
  nest: THREE.Vector3
  spawnForward: THREE.Vector3
  route: RoutePoint[]
  fixture: THREE.Mesh
  bounds: THREE.Box3
}

type V3 = [number, number, number]

class Builder {
  parts: THREE.BufferGeometry[] = []

  box(a: V3, b: V3, color: number, jitter = 0.05) {
    const g = new THREE.BoxGeometry(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    g.deleteAttribute('uv')
    const base = new THREE.Color(color)
    const k = 1 + (Math.random() * 2 - 1) * jitter
    const nrm = g.getAttribute('normal')
    const cols = new Float32Array(nrm.count * 3)
    for (let i = 0; i < nrm.count; i++) {
      const ny = nrm.getY(i)
      const s = k * (ny > 0.5 ? 1.05 : ny < -0.5 ? 0.62 : 0.88)
      cols[i * 3] = base.r * s
      cols[i * 3 + 1] = base.g * s
      cols[i * 3 + 2] = base.b * s
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    this.parts.push(g)
  }

  mesh(material: THREE.Material) {
    const geo = mergeGeometries(this.parts, false)
    geo.computeBoundingSphere()
    geo.computeBoundingBox()
    return new THREE.Mesh(geo, material)
  }
}

const WALL = 0x77746b
const CEIL = 0x5f5d58
const BASE = 0xd6d0c2
const CAB = 0xd3c9b5
const SEAM = 0x8f8676
const TOP = 0x565a5d
const DARK = 0x1d1e20
const WOOD = 0x7a5236
const CHAIR = 0x5c3e28
const STEEL = 0x9aa1a6
const FRIDGE = 0xdcdad3

export function buildWorld(shadows: boolean): World {
  const root = new THREE.Group()
  const b = new Builder()

  b.box([-260, 0, -210], [260, 250, -200], WALL, 0)
  b.box([-260, 0, 200], [260, 250, 210], WALL, 0)
  b.box([-260, 0, -200], [-250, 250, 200], WALL, 0)
  b.box([250, 0, -200], [260, 250, 200], WALL, 0)
  b.box([-250, 240, -200], [250, 250, 200], CEIL, 0)

  b.box([100, 0, -200], [250, 7, -198.8], BASE)
  b.box([-250, 0, 198.8], [250, 7, 200], BASE)
  b.box([-250, 0, -140], [-248.8, 7, 100], BASE)
  b.box([-250, 0, 180], [-248.8, 7, 200], BASE)
  b.box([248.8, 0, -200], [250, 7, 200], BASE)

  b.box([-250, 0, 100], [-248, 205, 180], 0x5a3b26)
  b.box([-250, 0, 97], [-246.8, 208, 100], 0x8a6a4a)
  b.box([-250, 0, 180], [-246.8, 208, 183], 0x8a6a4a)
  b.box([-250, 205, 97], [-246.8, 208, 183], 0x8a6a4a)
  b.box([-248, 94, 166], [-244, 98, 172], 0xb08a3a)

  b.box([-250, 0, -200], [100, 10, -150], DARK)
  b.box([-250, 10, -200], [100, 86, -146], CAB)
  b.box([-250, 86, -200], [100, 90, -140], TOP)
  for (const x of [-200, -150, -100, -50, 0, 50]) b.box([x - 0.4, 12, -146], [x + 0.4, 84, -145.85], SEAM, 0)
  b.box([-250, 69.6, -146], [100, 70.4, -145.85], SEAM, 0)
  for (const cx of [-225, -175, -125, -75, -25, 25, 75]) b.box([cx - 6, 74, -145.85], [cx + 6, 76, -144.6], STEEL)
  b.box([-250, 90, -200], [100, 150, -199.4], 0xa3adb0)
  b.box([-250, 150, -200], [100, 215, -168], CAB)
  for (const x of [-200, -150, -100, -50, 0, 50]) b.box([x - 0.4, 151, -168], [x + 0.4, 214, -167.85], SEAM, 0)
  for (const cx of [-225, -175, -125, -75, -25, 25, 75]) b.box([cx - 6, 153, -167.85], [cx + 6, 155, -166.6], STEEL)

  b.box([-125, 90, -192], [-65, 91.2, -148], STEEL)
  b.box([-120, 91.2, -187], [-70, 91.5, -153], 0x3b4044)
  b.box([-97, 91, -196], [-93, 118, -192], STEEL)
  b.box([-97, 114, -196], [-93, 118, -176], STEEL)
  b.box([15, 90, -192], [90, 92.5, -146], DARK)
  b.box([24, 92.5, -186], [46, 93.3, -166], 0x2f2f30)
  b.box([58, 92.5, -186], [80, 93.3, -166], 0x2f2f30)
  b.box([-205, 90, -192], [-185, 122, -180], 0xb8402e)
  b.box([-205, 106, -180.2], [-185, 114, -179.9], 0xe8c547)
  b.box([-160, 90, -178], [-152, 99, -170], 0xe0ddd0)
  b.box([-45, 90, -186], [-10, 91.5, -160], 0xb08a5e)

  b.box([120, 3, -200], [200, 183, -128], FRIDGE)
  b.box([120, 119.7, -128], [200, 120.3, -127.85], 0x77746e, 0)
  b.box([190, 60, -127.85], [194, 110, -124], 0x9a9a9a)
  b.box([190, 128, -127.85], [194, 170, -124], 0x9a9a9a)
  for (const [x, z] of [[122, -198], [194, -198], [122, -134], [194, -134]]) b.box([x, 0, z], [x + 4, 3, z + 4], DARK)
  for (let i = 0; i < 9; i++) {
    const x = 150 + Math.random() * 22
    const z = -172 + Math.random() * 16
    b.box([x, 0, z], [x + 1.2 + Math.random(), 0.6 + Math.random() * 0.6, z + 1 + Math.random()], 0x3b2a14, 0.2)
  }

  b.box([-80, 72, 0], [40, 76, 80], WOOD)
  for (const [x, z] of [[-76, 4], [31, 4], [-76, 71], [31, 71]]) b.box([x, 0, z], [x + 5, 72, z + 5], WOOD)
  b.box([-35, 76, 28], [-12, 77, 50], 0xe9e6dd)
  b.box([10, 76, 50], [17, 85, 57], 0x4a6a8a)

  b.box([-40, 43, 95], [0, 46, 135], CHAIR)
  for (const [x, z] of [[-39, 96], [-4, 96], [-39, 131], [-4, 131]]) b.box([x, 0, z], [x + 3, 43, z + 3], CHAIR)
  b.box([-40, 46, 131], [0, 92, 135], CHAIR)
  b.box([-125, 43, 20], [-85, 46, 60], CHAIR)
  for (const [x, z] of [[-124, 21], [-89, 21], [-124, 56], [-89, 56]]) b.box([x, 0, z], [x + 3, 43, z + 3], CHAIR)
  b.box([-125, 46, 20], [-121, 92, 60], CHAIR)

  b.box([208, 0, 148], [240, 48, 185], 0x5c6166)
  b.box([206, 48, 146], [242, 50, 187], 0x4d5155)

  b.box([238, 98, -45], [250, 101, 65], 0xcfcac0)
  b.box([248, 101, 9], [250, 190, 11], 0xcfcac0)
  b.box([248, 145, -40], [250, 147, 60], 0xcfcac0)
  b.box([247, 101, -45], [250, 192, -40], 0xcfcac0)
  b.box([247, 101, 60], [250, 192, 65], 0xcfcac0)
  b.box([247, 190, -45], [250, 193, 65], 0xcfcac0)

  b.box([-150, 130, 188], [-30, 133, 200], WOOD)
  b.box([-140, 133, 191], [-128, 149, 198], 0x6a8a5a)
  b.box([-122, 133, 191], [-110, 145, 198], 0xb0763a)
  b.box([-60, 133, 190], [-40, 141, 199], 0xd8d2c2)

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
  const stat = b.mesh(mat)
  stat.name = 'kitchen'
  stat.castShadow = shadows
  stat.receiveShadow = shadows
  root.add(stat)

  const floorGeo = new THREE.PlaneGeometry(500, 400).rotateX(-Math.PI / 2)
  const tiles = tileTexture()
  tiles.repeat.set(500 / 60, 400 / 60)
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ map: tiles }))
  floor.receiveShadow = shadows
  root.add(floor)

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 88).rotateY(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x29406e, fog: false })
  )
  glass.position.set(249.5, 146, 10)
  root.add(glass)

  const glow = glowTexture()
  const moonPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 110).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glow, color: 0x3d5590, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
  )
  moonPatch.position.set(170, 0.12, 10)
  root.add(moonPatch)

  const fixture = new THREE.Mesh(new THREE.BoxGeometry(44, 6, 44), new THREE.MeshBasicMaterial({ color: 0x3a3833 }))
  fixture.position.set(0, 237, 0)
  root.add(fixture)

  root.updateMatrixWorld(true)

  const crumbs = [
    [-24, 77.9, 40],
    [28, 76.9, 12],
    [-55, 0.9, 50],
    [-172, 90.9, -160],
    [0, 90.9, -155],
    [-20, 46.9, 112],
    [244, 101.9, 10],
    [160, 183.9, -165],
    [190, 0.9, 120],
    [90, 0.9, 40],
    [-110, 215.9, -185],
    [225, 50.9, 166],
    [-90, 133.9, 195]
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z))

  const rp = (x: number, z: number, pause = 0): RoutePoint => ({ p: new THREE.Vector2(x, z), pause })
  const route = [
    rp(-225, 140),
    rp(-150, 160),
    rp(80, 160),
    rp(112, 40, 2.6),
    rp(95, -100),
    rp(-60, -100, 2.6),
    rp(-175, -95),
    rp(-175, 60),
    rp(-225, 140)
  ]

  return {
    root,
    colliders: [stat, floor, fixture],
    crumbs,
    nest: new THREE.Vector3(160, 0, -164),
    spawnForward: new THREE.Vector3(-0.35, 0, 1).normalize(),
    route,
    fixture,
    bounds: new THREE.Box3(new THREE.Vector3(-252, -5, -202), new THREE.Vector3(252, 245, 202))
  }
}
