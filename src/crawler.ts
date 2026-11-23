import * as THREE from 'three'

export const HOVER = 0.35
const GRAVITY = 520
const FLUTTER_GRAVITY = 110
const JUMP = 135
const SUBSTEP = 0.6

export type Hit = { point: THREE.Vector3; normal: THREE.Vector3; distance: number }

const Y = new THREE.Vector3(0, 1, 0)

export class Crawler {
  pos = new THREE.Vector3()
  up = new THREE.Vector3(0, 1, 0)
  forward = new THREE.Vector3(0, 0, 1)
  vel = new THREE.Vector3()
  airborne = false
  alignedAt = -1
  clock = 0
  private ray = new THREE.Raycaster()
  private q = new THREE.Quaternion()
  private qi = new THREE.Quaternion()

  constructor(private colliders: THREE.Object3D[]) {}

  place(pos: THREE.Vector3, forward: THREE.Vector3) {
    this.pos.copy(pos)
    this.up.copy(Y)
    this.forward.copy(forward)
    this.orthonormalize()
    this.airborne = false
    this.vel.set(0, 0, 0)
    this.snapGround()
  }

  right(out = new THREE.Vector3()) {
    return out.crossVectors(this.forward, this.up).normalize()
  }

  dirFor(mx: number, my: number, out = new THREE.Vector3()) {
    const r = this.right()
    return out.set(0, 0, 0).addScaledVector(this.forward, my).addScaledVector(r, mx).normalize()
  }

  yaw(angle: number) {
    this.forward.applyAxisAngle(this.up, angle)
    this.orthonormalize()
  }

  cast(origin: THREE.Vector3, dir: THREE.Vector3, far: number): Hit | null {
    this.ray.set(origin, dir)
    this.ray.near = 0
    this.ray.far = far
    const hits = this.ray.intersectObjects(this.colliders, false)
    for (const h of hits) {
      if (!h.face) continue
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld)
      if (n.dot(dir) > -0.02) continue
      return { point: h.point.clone(), normal: n, distance: h.distance }
    }
    return null
  }

  jump(mx: number, my: number, speed: number) {
    if (this.airborne) return false
    const dir = this.dirFor(mx, my)
    this.vel.copy(this.up).multiplyScalar(JUMP).addScaledVector(dir, speed * 0.7)
    this.pos.addScaledVector(this.up, 0.2)
    this.airborne = true
    return true
  }

  step(dt: number, mx: number, my: number, speed: number, flutter: boolean): 'land' | null {
    this.clock += dt
    if (this.airborne) return this.stepAir(dt, mx, my, flutter)
    const len = Math.hypot(mx, my)
    if (len > 0.01) {
      const mag = Math.min(1, len)
      const nx = mx / len
      const ny = my / len
      let remaining = speed * mag * dt
      while (remaining > 1e-4 && !this.airborne) {
        const d = Math.min(remaining, SUBSTEP)
        this.moveOnce(nx, ny, d)
        remaining -= d
      }
    } else if (!this.snapGround()) {
      this.fall(new THREE.Vector3())
    }
    return null
  }

  private moveOnce(nx: number, ny: number, d: number) {
    const dir = this.dirFor(nx, ny)
    const hit = this.cast(this.pos, dir, d + HOVER + 0.15)
    if (hit && hit.normal.dot(this.up) < 0.7 && hit.distance - HOVER <= d + 0.05) {
      this.align(hit.normal)
      this.pos.copy(hit.point).addScaledVector(hit.normal, HOVER)
      return
    }
    this.pos.addScaledVector(dir, d)
    if (!this.snapGround()) this.wrap(dir)
  }

  snapGround() {
    const origin = this.pos.clone().addScaledVector(this.up, 0.5)
    const down = this.up.clone().negate()
    const hit = this.cast(origin, down, 0.5 + HOVER + 0.7)
    if (!hit) return false
    if (hit.normal.dot(this.up) < 0.9999) this.align(hit.normal)
    this.pos.copy(hit.point).addScaledVector(hit.normal, HOVER)
    return true
  }

  private wrap(dir: THREE.Vector3) {
    const origin = this.pos.clone().addScaledVector(this.up, -(HOVER + 0.25))
    const back = dir.clone().negate()
    const hit = this.cast(origin, back, 2.0)
    if (hit && hit.normal.dot(dir) > 0.5) {
      this.align(hit.normal)
      this.pos.copy(hit.point).addScaledVector(hit.normal, HOVER)
      return
    }
    this.fall(dir)
  }

  private fall(dir: THREE.Vector3) {
    this.airborne = true
    this.vel.copy(dir).multiplyScalar(25)
  }

  private stepAir(dt: number, mx: number, my: number, flutter: boolean): 'land' | null {
    const fluttering = flutter && this.vel.y < 0
    this.vel.y -= (fluttering ? FLUTTER_GRAVITY : GRAVITY) * dt
    if (fluttering) {
      this.vel.y = Math.max(this.vel.y, -55)
      if (Math.hypot(mx, my) > 0.05) {
        const d = this.dirFor(mx, my)
        d.y = 0
        if (d.lengthSq() > 1e-4) this.vel.addScaledVector(d.normalize(), 90 * dt)
      }
      const h = Math.hypot(this.vel.x, this.vel.z)
      if (h > 80) {
        this.vel.x *= 80 / h
        this.vel.z *= 80 / h
      }
    }
    this.vel.y = Math.max(this.vel.y, -900)
    const len = this.vel.length() * dt
    if (len > 1e-5) {
      const dir = this.vel.clone().normalize()
      const hit = this.cast(this.pos, dir, len + HOVER)
      if (hit) {
        this.airborne = false
        this.vel.set(0, 0, 0)
        this.align(hit.normal)
        this.pos.copy(hit.point).addScaledVector(hit.normal, HOVER)
        return 'land'
      }
      this.pos.addScaledVector(this.vel, dt)
    }
    this.q.setFromUnitVectors(this.up, Y)
    this.qi.identity().slerp(this.q, Math.min(1, dt * 2.5))
    this.up.applyQuaternion(this.qi).normalize()
    this.forward.applyQuaternion(this.qi)
    this.orthonormalize()
    return null
  }

  private align(n: THREE.Vector3) {
    this.q.setFromUnitVectors(this.up, n)
    this.forward.applyQuaternion(this.q)
    this.up.copy(n)
    this.orthonormalize()
    this.alignedAt = this.clock
  }

  private orthonormalize() {
    this.forward.addScaledVector(this.up, -this.forward.dot(this.up))
    if (this.forward.lengthSq() < 1e-6) {
      this.forward.set(Math.abs(this.up.x) > 0.9 ? 0 : 1, 0, Math.abs(this.up.x) > 0.9 ? 1 : 0)
      this.forward.addScaledVector(this.up, -this.forward.dot(this.up))
    }
    this.forward.normalize()
  }
}
