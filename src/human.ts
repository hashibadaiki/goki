import * as THREE from 'three'
import type { RoutePoint } from './world'

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const turnToward = (from: number, to: number, maxStep: number) => {
  const d = wrapAngle(to - from)
  return from + Math.max(-maxStep, Math.min(maxStep, d))
}
const damp = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, k)

export class Human {
  group = new THREE.Group()
  feet: THREE.Mesh[] = []
  active = false
  done = false
  heading = 0
  private hips: THREE.Group[] = []
  private arms: THREE.Group[] = []
  private head = new THREE.Group()
  private route: RoutePoint[] = []
  private idx = 0
  private pause = 0
  private walk = 0
  private amp = 0
  private headYaw = 0
  private speed = 62
  private eye = new THREE.Vector3(0, 19, 12)

  constructor(scene: THREE.Scene, shadows: boolean) {
    const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c })
    const skin = lam(0xd2a184)
    const shirt = lam(0x3f5f7f)
    const pants = lam(0x2a2e38)
    const slipper = lam(0x8a6fb0)
    const hair = lam(0x18120e)
    const dark = new THREE.MeshBasicMaterial({ color: 0x111111 })
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z)
      mesh.castShadow = shadows
      parent.add(mesh)
      return mesh
    }
    box(40, 58, 22, shirt, 0, 117, 0, this.group)
    for (const s of [-1, 1]) {
      const hip = new THREE.Group()
      hip.position.set(10 * s, 88, 0)
      this.group.add(hip)
      this.hips.push(hip)
      box(15, 80, 15, pants, 0, -40, 0, hip)
      this.feet.push(box(13, 5, 27, slipper, 0, -85, 5, hip))
      const shoulder = new THREE.Group()
      shoulder.position.set(25 * s, 142, 0)
      this.group.add(shoulder)
      this.arms.push(shoulder)
      box(10, 54, 10, shirt, 0, -26, 0, shoulder)
      box(9, 10, 9, skin, 0, -58, 0, shoulder)
    }
    this.head.position.set(0, 146, 0)
    this.group.add(this.head)
    box(12, 8, 12, skin, 0, 3, 0, this.head)
    box(22, 26, 24, skin, 0, 18, 0, this.head)
    box(24, 7, 26, hair, 0, 32, -1, this.head)
    for (const s of [-1, 1]) box(4, 2.5, 1, dark, 5 * s, 19, 12.2, this.head)
    this.group.visible = false
    scene.add(this.group)
  }

  start(route: RoutePoint[]) {
    this.route = route
    this.idx = 1
    this.pause = 0
    this.group.position.set(route[0].p.x, 0, route[0].p.y)
    this.heading = Math.atan2(route[1].p.x - route[0].p.x, route[1].p.y - route[0].p.y)
    this.active = true
    this.done = false
    this.group.visible = true
  }

  reset() {
    this.active = false
    this.done = false
    this.group.visible = false
  }

  headWorld(out: THREE.Vector3) {
    return this.head.localToWorld(out.copy(this.eye))
  }

  facing(out: THREE.Vector3) {
    const a = this.heading + this.headYaw
    return out.set(Math.sin(a), 0, Math.cos(a))
  }

  update(dt: number, focus: THREE.Vector3 | null) {
    if (!this.active) return
    const pos = this.group.position
    let moving = false
    if (focus) {
      const want = Math.atan2(focus.x - pos.x, focus.z - pos.z)
      this.heading = turnToward(this.heading, want, 3.5 * dt)
      this.headYaw = damp(this.headYaw, 0, dt * 6)
    } else if (this.pause > 0) {
      this.pause -= dt
      this.headYaw = Math.sin(this.pause * 1.7) * 0.75
    } else {
      const t = this.route[this.idx]
      const dx = t.p.x - pos.x
      const dz = t.p.y - pos.z
      const d = Math.hypot(dx, dz)
      if (d < 4) {
        this.pause = t.pause
        this.idx++
        if (this.idx >= this.route.length) {
          this.reset()
          this.done = true
          return
        }
      } else {
        const want = Math.atan2(dx, dz)
        this.heading = turnToward(this.heading, want, 4 * dt)
        if (Math.abs(wrapAngle(want - this.heading)) < 0.6) {
          const s = Math.min(d, this.speed * dt)
          pos.x += Math.sin(this.heading) * s
          pos.z += Math.cos(this.heading) * s
          moving = true
        }
        this.headYaw = damp(this.headYaw, 0, dt * 3)
      }
    }
    if (moving) this.walk += (dt * this.speed) / 26
    this.amp = damp(this.amp, moving ? 1 : 0, dt * 6)
    const s = Math.sin(this.walk) * 0.42 * this.amp
    this.hips[0].rotation.x = s
    this.hips[1].rotation.x = -s
    this.arms[0].rotation.x = -s * 0.8
    this.arms[1].rotation.x = s * 0.8
    pos.y = Math.abs(Math.cos(this.walk)) * 1.5 * this.amp
    this.group.rotation.y = this.heading
    this.head.rotation.y = this.headYaw
    this.group.updateMatrixWorld(true)
  }
}
