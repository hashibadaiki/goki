import './style.css'
import { Game } from './game'

const canvas = document.getElementById('view') as HTMLCanvasElement
const game = new Game(canvas)
if (import.meta.env.DEV) Object.assign(window, { __goki: game })
