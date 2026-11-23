import * as THREE from 'three'

export class Antennae {
  group = new THREE.Group()
  private pivots: THREE.Group[] = []

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x3a1d0c, depthTest: false, depthWrite: false, fog: false })
    for (const s of [-1, 1]) {
      const root = new THREE.Vector3(0.12 * s, -0.24, -0.26)
      const pts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.12 * s, 0.1, -0.5),
        new THREE.Vector3(0.6 * s, 0.32, -1.7),
        new THREE.Vector3(1.9 * s, 0.5, -3.8)
      ]
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.0045, 5, false)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.renderOrder = 10
      mesh.frustumCulled = false
      const pivot = new THREE.Group()
      pivot.position.copy(root)
      pivot.add(mesh)
      this.group.add(pivot)
      this.pivots.push(pivot)
    }
  }

  update(t: number, speed: number) {
    this.pivots.forEach((p, i) => {
      const ph = i * 1.9
      p.rotation.x = Math.sin(t * 1.6 + ph) * 0.05 + Math.sin(t * 11 + ph) * 0.025 * speed
      p.rotation.y = Math.sin(t * 1.15 + ph) * 0.07 + Math.sin(t * 7 + ph) * 0.02 * speed
    })
  }
}
