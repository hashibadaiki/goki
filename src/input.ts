const STICK = 55

export class Input {
  move = { x: 0, y: 0 }
  look = { x: 0, y: 0 }
  jumpHeld = false
  jumpPressed = false
  dash = false
  touchMode = window.matchMedia('(pointer: coarse)').matches
  private keys = new Set<string>()
  private stickId = -1
  private stickOrigin = { x: 0, y: 0 }
  private stickVec = { x: 0, y: 0 }
  private lookId = -1
  private lookLast = { x: 0, y: 0 }
  private dragging = false

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code)
      if (e.code === 'Space') {
        if (!e.repeat) this.jumpPressed = true
        this.jumpHeld = true
        e.preventDefault()
      }
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
      if (e.code === 'Space') this.jumpHeld = false
    })
    window.addEventListener('blur', () => this.clear())
    document.addEventListener('mousemove', (e) => {
      if (this.locked || this.dragging) {
        this.look.x += e.movementX
        this.look.y += e.movementY
      }
    })
    canvas.addEventListener('mousedown', () => {
      if (!this.locked) this.dragging = true
    })
    window.addEventListener('mouseup', () => {
      this.dragging = false
    })
    this.setupTouch()
  }

  get locked() {
    return document.pointerLockElement === this.canvas
  }

  lock() {
    if (this.touchMode || this.locked) return
    try {
      const r = this.canvas.requestPointerLock() as unknown
      if (r instanceof Promise) r.catch(() => {})
    } catch {
      return
    }
  }

  unlock() {
    if (this.locked) document.exitPointerLock()
  }

  clear() {
    this.keys.clear()
    this.jumpHeld = false
    this.jumpPressed = false
    this.stickId = -1
    this.lookId = -1
    this.stickVec.x = this.stickVec.y = 0
    document.getElementById('stick')?.classList.remove('on')
    document.getElementById('btn-jump')?.classList.remove('held')
  }

  private setupTouch() {
    const zone = document.getElementById('touch')!
    const stick = document.getElementById('stick')!
    const knob = document.getElementById('knob')!
    const jump = document.getElementById('btn-jump')!
    const pause = document.getElementById('btn-pause')!

    zone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return
      this.touchMode = true
      document.body.classList.add('touch')
      if (e.target === jump || e.target === pause) return
      if (e.clientX < window.innerWidth * 0.45 && this.stickId < 0) {
        this.stickId = e.pointerId
        this.stickOrigin = { x: e.clientX, y: e.clientY }
        stick.style.left = `${e.clientX}px`
        stick.style.top = `${e.clientY}px`
        knob.style.transform = ''
        stick.classList.add('on')
      } else if (this.lookId < 0) {
        this.lookId = e.pointerId
        this.lookLast = { x: e.clientX, y: e.clientY }
      }
      zone.setPointerCapture(e.pointerId)
    })

    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) {
        let dx = e.clientX - this.stickOrigin.x
        let dy = e.clientY - this.stickOrigin.y
        const len = Math.hypot(dx, dy)
        if (len > STICK) {
          dx *= STICK / len
          dy *= STICK / len
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`
        this.stickVec = { x: dx / STICK, y: -dy / STICK }
      } else if (e.pointerId === this.lookId) {
        this.look.x += (e.clientX - this.lookLast.x) * 1.7
        this.look.y += (e.clientY - this.lookLast.y) * 1.7
        this.lookLast = { x: e.clientX, y: e.clientY }
      }
    })

    const end = (e: PointerEvent) => {
      if (e.pointerId === this.stickId) {
        this.stickId = -1
        this.stickVec = { x: 0, y: 0 }
        stick.classList.remove('on')
      }
      if (e.pointerId === this.lookId) this.lookId = -1
    }
    zone.addEventListener('pointerup', end)
    zone.addEventListener('pointercancel', end)

    jump.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      this.jumpPressed = true
      this.jumpHeld = true
      jump.classList.add('held')
      jump.setPointerCapture(e.pointerId)
    })
    const release = () => {
      this.jumpHeld = false
      jump.classList.remove('held')
    }
    jump.addEventListener('pointerup', release)
    jump.addEventListener('pointercancel', release)
  }

  update() {
    let x = 0
    let y = 0
    const k = this.keys
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1
    if (this.stickId >= 0) {
      x += this.stickVec.x
      y += this.stickVec.y
    }
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    this.move.x = x
    this.move.y = y
    this.dash = k.has('ShiftLeft') || k.has('ShiftRight') || (this.stickId >= 0 && Math.hypot(this.stickVec.x, this.stickVec.y) > 0.92)
  }

  consumeLook() {
    const r = { x: this.look.x, y: this.look.y }
    this.look.x = 0
    this.look.y = 0
    return r
  }

  endFrame() {
    this.jumpPressed = false
  }
}
