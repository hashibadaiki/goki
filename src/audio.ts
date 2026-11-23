type Ctor = typeof AudioContext

export class Sfx {
  private ctx: AudioContext | null = null
  private out: GainNode | null = null
  private noise: AudioBuffer | null = null
  private humGain: GainNode | null = null

  unlock() {
    if (!this.ctx) {
      const AC: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
      if (!AC) return
      const ctx = new AC()
      this.ctx = ctx
      this.out = ctx.createGain()
      this.out.gain.value = 0.8
      this.out.connect(ctx.destination)
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      this.noise = buf
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = 50
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 150
      this.humGain = ctx.createGain()
      this.humGain.gain.value = 0
      osc.connect(lp).connect(this.humGain).connect(this.out)
      osc.start()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private burst(dur: number, freq: number, q: number, type: BiquadFilterType, vol: number, delay = 0) {
    const ctx = this.ctx
    if (!ctx || !this.out || !this.noise || vol <= 0.001) return
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur * 0.2))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(this.out)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.05)
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', slide = 0, delay = 0) {
    const ctx = this.ctx
    if (!ctx || !this.out || vol <= 0.001) return
    const t = ctx.currentTime + delay
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide > 0) o.frequency.exponentialRampToValueAtTime(slide, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.out)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  skitter(vol: number) {
    this.burst(0.022, 4500 + Math.random() * 3000, 2.5, 'bandpass', 0.07 * vol)
  }

  flutter() {
    this.burst(0.035, 160 + Math.random() * 60, 1.2, 'bandpass', 0.22)
  }

  step(vol: number) {
    this.tone(58, 0.2, 0.55 * vol, 'sine', 32)
    this.burst(0.09, 320, 0.8, 'lowpass', 0.3 * vol)
  }

  slam(vol: number) {
    this.tone(72, 0.4, 0.95 * vol, 'sine', 28)
    this.burst(0.28, 900, 0.7, 'lowpass', 0.85 * vol)
  }

  click() {
    this.burst(0.02, 2600, 1, 'highpass', 0.35)
    this.tone(1700, 0.025, 0.08, 'square')
  }

  pickup() {
    this.tone(880, 0.08, 0.14, 'triangle', 1320)
    this.tone(1320, 0.14, 0.1, 'triangle', 0, 0.07)
  }

  enough() {
    this.tone(660, 0.12, 0.14, 'triangle')
    this.tone(880, 0.12, 0.14, 'triangle', 0, 0.1)
    this.tone(1320, 0.25, 0.14, 'triangle', 0, 0.2)
  }

  alarm() {
    this.tone(220, 0.3, 0.22, 'sawtooth', 440)
    this.tone(330, 0.3, 0.16, 'sawtooth', 660, 0.12)
  }

  hiss(vol: number) {
    this.burst(1.0, 5500, 0.6, 'highpass', 0.32 * vol)
  }

  hurt() {
    this.tone(170, 0.25, 0.3, 'square', 60)
  }

  win() {
    ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 0.16, 'triangle', 0, i * 0.11))
  }

  lose() {
    this.tone(300, 0.9, 0.22, 'sawtooth', 50)
  }

  hum(vol: number) {
    if (!this.ctx || !this.humGain) return
    this.humGain.gain.setTargetAtTime(vol * 0.06, this.ctx.currentTime, 0.3)
  }
}
