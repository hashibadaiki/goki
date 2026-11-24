import './style.css'
import { Game } from './game'
import { installDiag, log, noGl } from './diag'

const canvas = document.getElementById('view') as HTMLCanvasElement
installDiag(canvas)
if (noGl) {
  document.getElementById('start')?.addEventListener('click', () => log('start (nogl なのでゲームは起動しません)'))
} else {
  try {
    const game = new Game(canvas)
    log('game ready')
    if (import.meta.env.DEV) Object.assign(window, { __goki: game })
  } catch (e) {
    log(`game init failed: ${e instanceof Error ? e.message : String(e)}`)
    throw e
  }
}
