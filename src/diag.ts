const KEY = 'goki-diag'
const params = new URLSearchParams(location.search)

export const diagOn = params.has('diag') || params.has('nogl')
export const noGl = params.has('nogl')

const start = performance.now()
let box: HTMLPreElement | null = null
const lines: string[] = []
let status = ''

function stamp() {
  return `${((performance.now() - start) / 1000).toFixed(2)}s`
}

function render() {
  if (box) box.textContent = [status, ...lines].join('\n')
}

export function log(msg: string) {
  if (!diagOn) return
  lines.push(`${stamp()} ${msg}`)
  if (lines.length > 40) lines.splice(0, lines.length - 40)
  try {
    localStorage.setItem(KEY, JSON.stringify(lines))
  } catch {
    return render()
  }
  render()
}

function webglInfo() {
  const c = document.createElement('canvas')
  const gl2 = c.getContext('webgl2')
  const gl = gl2 ?? c.getContext('webgl')
  if (!gl) return 'webgl: none'
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
  const max = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return `webgl: ${gl2 ? '2' : '1'} ${name} maxTex=${max}`
}

export function installDiag(canvas: HTMLCanvasElement) {
  if (!diagOn) return
  let prev: string[] = []
  try {
    prev = JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    prev = []
  }
  box = document.createElement('pre')
  box.id = 'diag'
  document.body.appendChild(box)
  if (prev.length) {
    lines.push('--- 前回の記録 ---', ...prev.slice(-12), '--- 今回 ---')
  }
  log(navigator.userAgent)
  log(`dpr=${devicePixelRatio} view=${innerWidth}x${innerHeight} screen=${screen.width}x${screen.height}`)
  log(noGl ? 'nogl: 3D描画を止めています' : webglInfo())

  window.addEventListener('error', (e) => log(`error: ${e.message} @${e.filename?.split('/').pop()}:${e.lineno}`))
  window.addEventListener('unhandledrejection', (e) => log(`reject: ${String(e.reason)}`))
  window.addEventListener('resize', () => log(`resize ${innerWidth}x${innerHeight}`))
  window.visualViewport?.addEventListener('resize', () => {
    const v = window.visualViewport!
    log(`vv ${Math.round(v.width)}x${Math.round(v.height)} scale=${v.scale.toFixed(2)}`)
  })
  document.addEventListener('visibilitychange', () => log(`visibility ${document.visibilityState}`))
  window.addEventListener('pagehide', (e) => log(`pagehide persisted=${e.persisted}`))
  window.addEventListener('pageshow', (e) => log(`pageshow persisted=${e.persisted}`))
  for (const type of ['touchstart', 'touchend', 'pointerdown', 'click']) {
    document.addEventListener(type, (e) => log(`${type} on ${(e.target as HTMLElement).id || (e.target as HTMLElement).tagName}`), { capture: true, passive: true })
  }
  canvas.addEventListener('webglcontextlost', () => log('webglcontextlost'))
  canvas.addEventListener('webglcontextrestored', () => log('webglcontextrestored'))
  const menu = document.getElementById('menu')
  if (menu) {
    new MutationObserver(() => log(`menu class="${menu.className}"`)).observe(menu, { attributes: true, attributeFilter: ['class'] })
  }
  let frames = 0
  const tick = () => {
    frames++
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  setInterval(() => {
    status = `${stamp()} 動作中 fps=${Math.round(frames / 2)}`
    frames = 0
    render()
    try {
      localStorage.setItem(KEY, JSON.stringify([...lines, status]))
    } catch {
      return
    }
  }, 2000)
}
