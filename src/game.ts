import * as THREE from 'three'
import { buildWorld, type World } from './world'
import { Crawler, HOVER } from './crawler'
import { Input } from './input'
import { Human } from './human'
import { Hazards } from './hazards'
import { Sfx } from './audio'
import { AdaptiveRes, isMobile } from './quality'
import { Antennae } from './antennae'
import { glowTexture } from './textures'

const NEED = 8
const MAX_HP = 100
const WALK = 42
const DASH = 105
const LOOK = 0.0022
const SIGHT = 480
const NIGHT = new THREE.Color(0x05070c)
const LIT = new THREE.Color(0x2b2823)
const FIXTURE_OFF = new THREE.Color(0x3a3833)
const FIXTURE_ON = new THREE.Color(0xfff6e0)
const X = new THREE.Vector3(1, 0, 0)

type State = 'title' | 'playing' | 'paused' | 'over'
type Phase = 'dark' | 'steps' | 'lit'
type Cause = 'slam' | 'stomp' | 'spray'

const $ = (id: string) => document.getElementById(id) as HTMLElement

const DEATH: Record<Cause, string> = {
  slam: 'スリッパで叩き潰された…',
  stomp: '踏み潰された…',
  spray: '殺虫剤にやられた…'
}

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(85, 1, 0.05, 1500)
  private world: World
  private crawler: Crawler
  private input: Input
  private human: Human
  private hazards: Hazards
  private sfx = new Sfx()
  private res: AdaptiveRes
  private antennae = new Antennae()
  private hemi = new THREE.HemisphereLight(0x6474a8, 0x16161c, 1)
  private moon = new THREE.DirectionalLight(0x9db4ff, 1.6)
  private lamp = new THREE.SpotLight(0xfff0d8, 0, 0, 1.3, 0.6, 0)
  private fog: THREE.Fog
  private crumbMesh: THREE.InstancedMesh
  private glow: THREE.Points
  private nestGlow: THREE.Mesh
  private mobile: boolean
  private collected: boolean[] = []
  private state: State = 'title'
  private phase: Phase = 'dark'
  private phaseT = 0
  private phaseLen = 22
  private cycle = 0
  private stepT = 0
  private light = 0
  private lightTarget = 0
  private flicker = 0
  private hp = MAX_HP
  private stamina = 100
  private lastHurt = -99
  private flash = 0
  private crumbs = 0
  private meter = 0
  private alert = false
  private lostT = 0
  private attackT = 0
  private stompT = 0
  private spotted = 0
  private time = 0
  private playTime = 0
  private pitch = -0.08
  private moveAmt = 0
  private running = false
  private moveDir = new THREE.Vector3()
  private camUp = new THREE.Vector3(0, 1, 0)
  private snap = true
  private shake = 0
  private bob = 0
  private skitterT = 0
  private flutterT = 0
  private toastT = 0
  private frame = 0
  private last = performance.now()
  private m4 = new THREE.Matrix4()
  private qBase = new THREE.Quaternion()
  private qPitch = new THREE.Quaternion()
  private v1 = new THREE.Vector3()
  private v2 = new THREE.Vector3()
  private v3 = new THREE.Vector3()
  private dummy = new THREE.Object3D()
  private hudCache = new Map<string, string>()

  constructor(canvas: HTMLCanvasElement) {
    this.mobile = isMobile()
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, powerPreference: 'high-performance', stencil: false })
    this.renderer.shadowMap.enabled = !this.mobile
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.shadowMap.autoUpdate = false
    this.res = new AdaptiveRes(this.renderer, Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2))

    this.scene.background = NIGHT.clone()
    this.fog = new THREE.Fog(NIGHT.clone(), 90, 650)
    this.scene.fog = this.fog
    this.scene.add(this.camera)
    this.camera.add(this.antennae.group)

    this.world = buildWorld(!this.mobile)
    this.scene.add(this.world.root)

    this.moon.position.set(420, 260, 40)
    this.scene.add(this.hemi, this.moon, this.moon.target)
    this.lamp.position.set(0, 233, 0)
    this.lamp.target.position.set(0, 0, 0)
    if (!this.mobile) {
      this.lamp.castShadow = true
      this.lamp.shadow.mapSize.set(1024, 1024)
      this.lamp.shadow.camera.near = 20
      this.lamp.shadow.camera.far = 420
      this.lamp.shadow.bias = -0.0008
    }
    this.scene.add(this.lamp, this.lamp.target)

    const soft = glowTexture()
    this.crawler = new Crawler(this.world.colliders)
    this.input = new Input(canvas)
    this.human = new Human(this.scene, !this.mobile)
    this.hazards = new Hazards(this.scene, this.sfx, soft)

    const n = this.world.crumbs.length
    this.crumbMesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.9, 0),
      new THREE.MeshLambertMaterial({ color: 0xe2ab5c, emissive: 0x5a3208 }),
      n
    )
    this.crumbMesh.frustumCulled = false
    this.scene.add(this.crumbMesh)
    const glowGeo = new THREE.BufferGeometry()
    glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    this.glow = new THREE.Points(
      glowGeo,
      new THREE.PointsMaterial({ size: 3.2, map: soft, color: 0xffb35a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    )
    this.glow.frustumCulled = false
    this.scene.add(this.glow)

    this.nestGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: soft, color: 0x5cff9a, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })
    )
    this.nestGlow.position.copy(this.world.nest).setY(0.08)
    this.scene.add(this.nestGlow)

    if (this.input.touchMode) document.body.classList.add('touch')
    this.bindUi()
    this.resize()
    window.addEventListener('resize', () => this.resize())
    this.reset()
    this.showMenu('title')
    requestAnimationFrame(this.loop)
  }

  private bindUi() {
    $('start').addEventListener('click', () => this.start())
    $('btn-pause').addEventListener('click', () => this.pause())
    document.addEventListener('pointerlockchange', () => {
      if (!this.input.locked && this.state === 'playing' && !this.input.touchMode) this.pause()
    })
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'playing') this.pause()
      else if ((e.code === 'Enter' || e.code === 'Space') && this.state !== 'playing' && $('menu').classList.contains('on')) {
        e.preventDefault()
        this.start()
      }
    })
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause()
    })
  }

  private resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.fov = w < h ? 95 : 85
    this.camera.updateProjectionMatrix()
  }

  private reset() {
    this.crawler.place(this.world.nest.clone().setY(HOVER), this.world.spawnForward)
    this.collected = this.world.crumbs.map(() => false)
    this.crumbs = 0
    this.hp = MAX_HP
    this.stamina = 100
    this.lastHurt = -99
    this.flash = 0
    this.phase = 'dark'
    this.phaseT = 0
    this.phaseLen = 24
    this.cycle = 0
    this.light = 0
    this.lightTarget = 0
    this.meter = 0
    this.alert = false
    this.lostT = 0
    this.spotted = 0
    this.playTime = 0
    this.pitch = -0.08
    this.snap = true
    this.shake = 0
    this.human.reset()
    this.hazards.clear()
    this.applyLight()
    this.updateCrumbs()
  }

  private start() {
    this.sfx.unlock()
    if (this.state === 'over' || this.state === 'title') this.reset()
    this.state = 'playing'
    $('menu').classList.remove('on')
    $('hud').classList.add('on')
    $('touch').classList.add('on')
    this.input.clear()
    this.input.lock()
    this.last = performance.now()
  }

  private pause() {
    if (this.state !== 'playing') return
    this.state = 'paused'
    this.input.unlock()
    this.input.clear()
    this.sfx.hum(0)
    this.showMenu('pause')
  }

  private showMenu(kind: 'title' | 'pause' | 'dead' | 'win', cause?: Cause) {
    const title = $('menu-title')
    const sub = $('menu-sub')
    const result = $('result')
    const btn = $('start')
    title.classList.toggle('small', kind === 'dead' || kind === 'win' || kind === 'pause')
    result.classList.toggle('on', kind === 'dead' || kind === 'win')
    if (kind === 'title') {
      title.textContent = 'GOKI'
      sub.textContent = '深夜のキッチン。パンくずを集めて、冷蔵庫の下の巣へ帰れ。'
      btn.textContent = 'はじめる'
    } else if (kind === 'pause') {
      title.textContent = '一時停止'
      sub.textContent = `パンくず ${this.crumbs} / ${NEED}`
      btn.textContent = '再開する'
    } else {
      const t = this.playTime
      const time = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
      title.textContent = kind === 'win' ? '生還！' : 'つぶれた'
      sub.textContent = kind === 'win' ? this.rank() : DEATH[cause ?? 'slam']
      result.innerHTML = `<div><b>${time}</b><span>タイム</span></div><div><b>${this.crumbs}</b><span>パンくず</span></div><div><b>${this.spotted}</b><span>見つかった</span></div>`
      btn.textContent = 'もう一度'
    }
    $('menu').classList.add('on')
    $('hud').classList.toggle('on', kind === 'pause')
    $('touch').classList.remove('on')
  }

  private rank() {
    const extra = this.crumbs - NEED
    if (this.spotted === 0 && extra >= 3) return '完璧な夜。誰にも気づかれず、食料庫は満杯だ。'
    if (this.spotted === 0) return '音もなく帰還した。見事な隠密行動。'
    if (this.playTime < 150) return '素早い帰還。人間は悪夢を見たと思うだろう。'
    return 'なんとか生き延びた。今夜の食料は確保だ。'
  }

  private loop = () => {
    requestAnimationFrame(this.loop)
    const now = performance.now()
    const ms = now - this.last
    this.last = now
    const dt = Math.min(ms / 1000, 0.05)
    this.time += dt
    this.frame++
    if (this.state === 'playing') {
      this.res.tick(ms)
      this.update(dt)
    }
    this.updateCrumbs()
    this.updateCamera(dt)
    this.antennae.update(this.time, this.moveAmt)
    if (this.lamp.castShadow && this.light > 0.05 && (this.frame & 1) === 0) this.renderer.shadowMap.needsUpdate = true
    this.renderer.render(this.scene, this.camera)
    this.input.endFrame()
  }

  private update(dt: number) {
    this.playTime += dt
    this.input.update()
    const look = this.input.consumeLook()
    const sens = LOOK * (this.input.touchMode ? 1.3 : 1)
    this.crawler.yaw(-look.x * sens)
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - look.y * sens))

    const { x: mx, y: my } = this.input.move
    const amount = Math.min(1, Math.hypot(mx, my))
    this.running = this.input.dash && this.stamina > 2 && amount > 0.1 && !this.crawler.airborne
    const speed = this.running ? DASH : WALK
    if (this.running) this.stamina = Math.max(0, this.stamina - 30 * dt)

    if (this.input.jumpPressed && this.crawler.jump(mx, my, speed * amount)) this.sfx.skitter(2)
    const flutter = this.input.jumpHeld && this.crawler.airborne && this.stamina > 0
    if (flutter && this.crawler.vel.y < 0) {
      this.stamina = Math.max(0, this.stamina - 32 * dt)
      this.flutterT -= dt
      if (this.flutterT <= 0) {
        this.sfx.flutter()
        this.flutterT = 0.045
      }
    } else if (!this.running) {
      this.stamina = Math.min(100, this.stamina + (this.crawler.airborne ? 0 : 22) * dt)
    }

    if (amount > 0.01) this.crawler.dirFor(mx, my, this.moveDir)
    this.crawler.step(dt, mx, my, speed, flutter)
    if (!this.world.bounds.containsPoint(this.crawler.pos) || !Number.isFinite(this.crawler.pos.x)) {
      this.crawler.place(this.world.nest.clone().setY(HOVER), this.world.spawnForward)
    }

    const onSurface = !this.crawler.airborne
    this.moveAmt = onSurface ? amount * (this.running ? 1.6 : 1) : 0
    if (this.moveAmt > 0) {
      this.bob += dt * (this.running ? 38 : 26)
      this.skitterT -= dt
      if (this.skitterT <= 0) {
        this.sfx.skitter(this.running ? 1.2 : 0.8)
        this.skitterT = this.running ? 0.03 : 0.055
      }
    }

    this.updatePhase(dt)
    this.updateThreat(dt)

    const hz = this.hazards.update(dt, this.crawler)
    if (hz.shake > 0) this.shake = Math.max(this.shake, hz.shake)
    if (hz.slam > 0) this.hurt(hz.slam, 'slam')
    if (hz.spray > 0) this.hurt(hz.spray, 'spray')

    if (this.time - this.lastHurt > 5) this.hp = Math.min(MAX_HP, this.hp + 5 * dt)
    this.flash = Math.max(0, this.flash - dt * 1.6)

    this.collect()
    this.applyLight()
    this.sfx.hum(Math.max(0, 1 - this.crawler.pos.distanceTo(this.world.nest) / 160))
    if (this.state === 'playing') this.updateHud(dt)
  }

  private updatePhase(dt: number) {
    this.phaseT += dt
    if (this.phase === 'dark' && this.phaseT >= this.phaseLen) {
      this.phase = 'steps'
      this.phaseT = 0
      this.stepT = 0
      this.toast('足音が近づいてくる…')
    } else if (this.phase === 'steps') {
      this.stepT -= dt
      if (this.stepT <= 0) {
        this.sfx.step(0.25 + this.phaseT / 3.5 * 0.6)
        this.stepT = 0.55
      }
      if (this.phaseT >= 3.5) {
        this.phase = 'lit'
        this.phaseT = 0
        this.sfx.click()
        this.lightTarget = 1
        this.flicker = 0.35
        const route = Math.random() < 0.5 ? this.world.route : [...this.world.route].reverse()
        this.human.start(route)
      }
    } else if (this.phase === 'lit' && this.human.done) {
      this.phase = 'dark'
      this.phaseT = 0
      this.cycle++
      this.phaseLen = Math.max(9, 19 - this.cycle * 1.5) + Math.random() * 6
      this.lightTarget = 0
      this.alert = false
      this.meter = 0
      this.sfx.click()
      this.toast('電気が消えた')
    }
  }

  private updateThreat(dt: number) {
    this.stompT -= dt
    if (!this.human.active) {
      this.meter = Math.max(0, this.meter - dt * 0.4)
      this.alert = false
      return
    }
    const p = this.crawler.pos
    const head = this.human.headWorld(this.v1)
    const to = this.v2.subVectors(p, head)
    const dist = to.length()
    let seen = false
    if (this.light > 0.5 && dist < SIGHT) {
      const f = this.human.facing(this.v3)
      const hl = Math.hypot(to.x, to.z) || 1
      const cos = (f.x * to.x + f.z * to.z) / hl
      if (cos > (this.alert ? -0.3 : 0.3)) {
        const dir = to.clone().divideScalar(dist)
        seen = !this.crawler.cast(head, dir, dist - 1.2)
      }
    }
    if (seen) {
      this.lostT = 0
      const gain = 0.3 + (1 - dist / SIGHT) * 1.3 + this.moveAmt * 0.45 + (this.running ? 0.6 : 0)
      this.meter = Math.min(1.2, this.meter + dt * gain)
    } else {
      this.lostT += dt
      if (!this.alert) this.meter = Math.max(0, this.meter - dt * 0.3)
    }
    if (!this.alert && this.meter >= 1) {
      this.alert = true
      this.spotted++
      this.attackT = 0.45
      this.sfx.alarm()
      this.toast('見つかった！ 逃げろ！')
    }
    if (this.alert) {
      if (this.lostT > 2.8) {
        this.alert = false
        this.meter = 0.55
        this.toast('見失ったようだ…')
      } else {
        this.attackT -= dt
        if (this.attackT <= 0 && this.lostT < 0.8 && !this.crawler.airborne) {
          this.attack()
          this.attackT = Math.max(1.1, 2.1 - this.cycle * 0.12) + Math.random() * 0.7
        }
      }
    }
    this.human.update(dt, this.alert ? p : null)

    if (!this.crawler.airborne && p.y < 3 && this.stompT <= 0) {
      for (const foot of this.human.feet) {
        foot.getWorldPosition(this.v3)
        if (this.v3.y < 5 && Math.hypot(this.v3.x - p.x, this.v3.z - p.z) < 10) {
          this.stompT = 1.2
          this.hurt(70, 'stomp')
          break
        }
      }
    }
  }

  private attack() {
    const up = this.crawler.up.clone()
    if (this.cycle >= 1 && Math.random() < 0.3) {
      this.hazards.spray(this.crawler.pos.clone())
      return
    }
    const target = this.crawler.pos.clone().addScaledVector(up, -HOVER)
    if (this.moveAmt > 0.3 && Math.random() < 0.5) target.addScaledVector(this.moveDir, (this.running ? DASH : WALK) * 0.3)
    this.hazards.slam(target, up)
  }

  private hurt(amount: number, cause: Cause) {
    if (this.state !== 'playing') return
    this.hp -= amount
    this.lastHurt = this.time
    this.flash = Math.min(1, this.flash + amount / 50)
    if (cause !== 'spray') {
      this.sfx.hurt()
      this.shake = Math.max(this.shake, 1)
    }
    if (this.hp <= 0) {
      this.hp = 0
      this.end(false, cause)
    }
  }

  private collect() {
    const p = this.crawler.pos
    this.world.crumbs.forEach((c, i) => {
      if (this.collected[i] || p.distanceTo(c) > 3.4) return
      this.collected[i] = true
      this.crumbs++
      if (this.crumbs === NEED) {
        this.sfx.enough()
        this.toast('十分集めた！ 冷蔵庫の下の巣へ戻れ')
      } else {
        this.sfx.pickup()
        this.toast(`パンくず ${this.crumbs} / ${NEED}`)
      }
    })
    if (this.crumbs >= NEED && !this.crawler.airborne && p.y < 3) {
      const d = Math.hypot(p.x - this.world.nest.x, p.z - this.world.nest.z)
      if (d < 14) this.end(true)
    }
  }

  private end(won: boolean, cause?: Cause) {
    this.state = 'over'
    this.input.unlock()
    this.input.clear()
    this.sfx.hum(0)
    if (won) this.sfx.win()
    else {
      this.sfx.lose()
      this.shake = 1.5
    }
    window.setTimeout(() => this.showMenu(won ? 'win' : 'dead', cause), won ? 300 : 700)
  }

  private applyLight() {
    if (this.lightTarget > 0) {
      this.flicker -= 1 / 60
      this.light = this.flicker > 0 ? (Math.random() < 0.45 ? 0.1 : 0.85) : 1
    } else {
      this.light = Math.max(0, this.light - 0.08)
    }
    const L = this.light
    this.lamp.intensity = L * 4.2
    this.hemi.intensity = 1 + L * 0.8
    this.moon.intensity = 1.6 * (1 - L * 0.5)
    ;(this.scene.background as THREE.Color).lerpColors(NIGHT, LIT, L)
    this.fog.color.lerpColors(NIGHT, LIT, L)
    this.fog.near = 90 + L * 300
    this.fog.far = 650 + L * 900
    ;(this.world.fixture.material as THREE.MeshBasicMaterial).color.lerpColors(FIXTURE_OFF, FIXTURE_ON, L)
    const nm = this.nestGlow.material as THREE.MeshBasicMaterial
    nm.opacity = this.crumbs >= NEED ? 0.55 + Math.sin(this.time * 4) * 0.2 : 0.22
  }

  private updateCrumbs() {
    const pos = this.glow.geometry.getAttribute('position') as THREE.BufferAttribute
    this.world.crumbs.forEach((c, i) => {
      const got = this.collected[i]
      this.dummy.position.copy(c)
      this.dummy.position.y += Math.sin(this.time * 2 + i) * 0.15
      this.dummy.rotation.set(this.time * 0.7 + i, this.time * 0.9 + i * 2, 0)
      this.dummy.scale.setScalar(got ? 0.0001 : 1)
      this.dummy.updateMatrix()
      this.crumbMesh.setMatrixAt(i, this.dummy.matrix)
      if (got) pos.setXYZ(i, 0, -9999, 0)
      else pos.setXYZ(i, c.x, c.y + 0.4, c.z)
    })
    this.crumbMesh.instanceMatrix.needsUpdate = true
    pos.needsUpdate = true
  }

  private updateCamera(dt: number) {
    const c = this.crawler
    const transitioning = c.clock - c.alignedAt < 0.35
    const k = 1 - Math.exp(-dt * (transitioning ? 9 : 40))
    const right = this.v1.crossVectors(c.forward, c.up).normalize()
    this.m4.makeBasis(right, c.up, this.v2.copy(c.forward).negate())
    this.qBase.setFromRotationMatrix(this.m4)
    this.qPitch.setFromAxisAngle(X, this.pitch)
    this.qBase.multiply(this.qPitch)
    if (this.snap) {
      this.camera.quaternion.copy(this.qBase)
      this.camUp.copy(c.up)
      this.snap = false
    } else {
      this.camera.quaternion.slerp(this.qBase, k)
      this.camUp.lerp(c.up, 1 - Math.exp(-dt * 10))
      if (this.camUp.lengthSq() < 1e-4) this.camUp.copy(c.up)
      this.camUp.normalize()
    }
    const bobY = Math.sin(this.bob) * 0.04 * Math.min(1, this.moveAmt)
    this.camera.position.copy(c.pos).addScaledVector(this.camUp, 0.55 + bobY)
    if (this.shake > 0) {
      const s = this.shake * 0.5
      this.camera.position.x += (Math.random() - 0.5) * s
      this.camera.position.y += (Math.random() - 0.5) * s
      this.camera.position.z += (Math.random() - 0.5) * s
      this.shake = Math.max(0, this.shake - dt * 2.5)
    }
  }

  private toast(text: string) {
    const t = $('toast')
    t.textContent = text
    t.classList.add('on')
    this.toastT = 2.4
  }

  private set(id: string, key: string, value: string, apply: (el: HTMLElement, v: string) => void) {
    const k = `${id}:${key}`
    if (this.hudCache.get(k) === value) return
    this.hudCache.set(k, value)
    apply($(id), value)
  }

  private updateHud(dt: number) {
    if (this.toastT > 0) {
      this.toastT -= dt
      if (this.toastT <= 0) $('toast').classList.remove('on')
    }
    const text = (el: HTMLElement, v: string) => {
      el.textContent = v
    }
    const scale = (el: HTMLElement, v: string) => {
      el.style.transform = `scaleX(${v})`
    }
    this.set('crumbs', 't', `${this.crumbs} / ${NEED}`, text)
    this.set('hp', 's', (this.hp / MAX_HP).toFixed(3), scale)
    this.set('stamina', 's', (this.stamina / 100).toFixed(3), scale)
    this.set('eyefill', 's', Math.min(1, this.meter).toFixed(2), scale)
    this.set('eye', 'c', this.alert ? 'eye alert' : 'eye', (el, v) => {
      el.className = v
    })
    this.set('hurt', 'o', this.flash.toFixed(2), (el, v) => {
      el.style.opacity = v
    })

    let phase = '消灯中 — 今のうちに集めろ'
    let cls = 'phase'
    if (this.phase === 'steps') phase = '足音が近づいてくる…'
    if (this.phase === 'lit') {
      phase = this.alert ? '見つかった！ 物陰へ逃げろ' : '点灯中 — 人間の視線に入るな'
      cls = this.alert ? 'phase alert' : 'phase lit'
    }
    this.set('phase', 't', phase, text)
    this.set('phase', 'c', cls, (el, v) => {
      el.className = v
    })

    const home = this.crumbs >= NEED
    this.set('guide', 'c', home ? 'guide on' : 'guide', (el, v) => {
      el.className = v
    })
    if (home) {
      const to = this.v1.copy(this.world.nest).sub(this.camera.position)
      const d = Math.round(to.length())
      to.applyQuaternion(this.qBase.copy(this.camera.quaternion).invert())
      const ang = Math.atan2(to.x, -to.z)
      this.set('guide-text', 't', `巣（冷蔵庫の下）まで ${d}cm`, text)
      this.set('arrow', 'r', ang.toFixed(2), (el, v) => {
        el.style.transform = `rotate(${v}rad)`
      })
    }
  }
}
