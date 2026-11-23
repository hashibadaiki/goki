import * as THREE from 'three'
import type { Sfx } from './audio'

const TELE = 0.75
const DOWN = 0.07
const STAY = 0.5
const UP = 0.4
const CLOUD_LIFE = 4.5
const SLAM_RADIUS = 11
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)

type Slam = {
  target: THREE.Vector3
  normal: THREE.Vector3
  t: number
  stage: 0 | 1 | 2 | 3
  slipper: THREE.Mesh
  shadow: THREE.Mesh
  mat: THREE.MeshBasicMaterial
}

type Cloud = {
  center: THREE.Vector3
  t: number
  delay: number
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  hissed: boolean
}

export type Probe = { pos: THREE.Vector3; up: THREE.Vector3; airborne: boolean }
export type HazardResult = { slam: number; spray: number; shake: number }

export class Hazards {
  private slams: Slam[] = []
  private clouds: Cloud[] = []
  private slipperGeo = new THREE.BoxGeometry(11, 2.5, 28)
  private slipperMat = new THREE.MeshLambertMaterial({ color: 0x8a6fb0 })
  private shadowGeo = new THREE.CircleGeometry(15, 28)
  private cloudGeo = new THREE.SphereGeometry(1, 14, 10)

  constructor(
    private scene: THREE.Scene,
    private sfx: Sfx,
    private soft: THREE.Texture
  ) {}

  slam(target: THREE.Vector3, normal: THREE.Vector3) {
    const slipper = new THREE.Mesh(this.slipperGeo, this.slipperMat)
    const spin = new THREE.Quaternion().setFromAxisAngle(Y, Math.random() * Math.PI * 2)
    slipper.quaternion.setFromUnitVectors(Y, normal).multiply(spin)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      map: this.soft,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    })
    const shadow = new THREE.Mesh(this.shadowGeo, mat)
    shadow.quaternion.setFromUnitVectors(Z, normal)
    shadow.position.copy(target).addScaledVector(normal, 0.1)
    this.scene.add(slipper, shadow)
    this.slams.push({ target: target.clone(), normal: normal.clone(), t: 0, stage: 0, slipper, shadow, mat })
  }

  spray(center: THREE.Vector3) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xd2e6c9, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(this.cloudGeo, mat)
    mesh.position.copy(center)
    mesh.scale.setScalar(0.01)
    this.scene.add(mesh)
    this.clouds.push({ center: center.clone(), t: 0, delay: 0.35, mesh, mat, hissed: false })
  }

  update(dt: number, p: Probe): HazardResult {
    const res: HazardResult = { slam: 0, spray: 0, shake: 0 }
    for (let i = this.slams.length - 1; i >= 0; i--) {
      const s = this.slams[i]
      s.t += dt
      let h = 60
      if (s.stage === 0) {
        const k = Math.min(1, s.t / TELE)
        h = 60 - 22 * k
        s.mat.opacity = 0.15 + 0.6 * k
        s.shadow.scale.setScalar(1.5 - 0.5 * k)
        if (s.t >= TELE) {
          s.stage = 1
          s.t = 0
        }
      } else if (s.stage === 1) {
        const k = Math.min(1, s.t / DOWN)
        h = 38 - 37.9 * k
        if (s.t >= DOWN) {
          s.stage = 2
          s.t = 0
          const d = p.pos.distanceTo(s.target)
          if (!p.airborne && d < SLAM_RADIUS && p.up.dot(s.normal) > 0.6) res.slam += 55
          const vol = Math.max(0, 1 - d / 320)
          this.sfx.slam(vol)
          res.shake = Math.max(res.shake, vol * vol * 1.6)
        }
      } else if (s.stage === 2) {
        h = 0.1
        if (s.t >= STAY) {
          s.stage = 3
          s.t = 0
        }
      } else {
        const k = Math.min(1, s.t / UP)
        h = 0.1 + 70 * k * k
        s.mat.opacity = 0.75 * (1 - k)
        if (s.t >= UP) {
          this.scene.remove(s.slipper, s.shadow)
          s.mat.dispose()
          this.slams.splice(i, 1)
          continue
        }
      }
      s.slipper.position.copy(s.target).addScaledVector(s.normal, h + 1.25)
    }

    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i]
      c.t += dt
      if (c.t < c.delay) {
        if (!c.hissed) {
          c.hissed = true
          this.sfx.hiss(Math.max(0.2, 1 - p.pos.distanceTo(c.center) / 400))
        }
        continue
      }
      const a = c.t - c.delay
      const r = 6 + 22 * Math.min(1, a / 0.5)
      const fade = a > CLOUD_LIFE - 1 ? Math.max(0, CLOUD_LIFE - a) : 1
      c.mesh.scale.setScalar(r)
      c.mat.opacity = 0.3 * fade
      if (p.pos.distanceTo(c.center) < r * 0.92) res.spray += 32 * dt * fade
      if (a >= CLOUD_LIFE) {
        this.scene.remove(c.mesh)
        c.mat.dispose()
        this.clouds.splice(i, 1)
      }
    }
    return res
  }

  clear() {
    for (const s of this.slams) {
      this.scene.remove(s.slipper, s.shadow)
      s.mat.dispose()
    }
    for (const c of this.clouds) {
      this.scene.remove(c.mesh)
      c.mat.dispose()
    }
    this.slams = []
    this.clouds = []
  }
}
