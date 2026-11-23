import type { WebGLRenderer } from 'three'

export function isMobile(): boolean {
  return (
    /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900)
  )
}

export class AdaptiveRes {
  scale = 1
  private acc = 0
  private n = 0
  private upWait = 2
  private upDelay = 3

  constructor(
    private renderer: WebGLRenderer,
    private baseDpr: number,
    private min = 0.55
  ) {
    this.apply()
  }

  apply() {
    this.renderer.setPixelRatio(this.baseDpr * this.scale)
  }

  tick(ms: number) {
    this.upWait -= ms / 1000
    this.acc += Math.min(ms, 100)
    this.n++
    if (this.n < 40) return
    const avg = this.acc / this.n
    this.acc = 0
    this.n = 0
    let s = this.scale
    if (avg > 21 && s > this.min) {
      s = Math.max(this.min, s - (avg > 30 ? 0.2 : 0.1))
      this.upDelay = Math.min(30, this.upDelay * 2)
      this.upWait = this.upDelay
    } else if (avg < 15.5 && s < 1 && this.upWait <= 0) {
      s = Math.min(1, s + 0.1)
      this.upWait = 2
    }
    s = Math.round(s * 10) / 10
    if (s !== this.scale) {
      this.scale = s
      this.apply()
    }
  }
}
