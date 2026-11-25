// Pixel sprites for the pet, drawn as SVG on the desktop and as text in the terminal.
import type { Pet, Reaction, Stage } from '../types'
import { KINDS, coatOf, gridOf, isSpecies } from './species'

export type Mood = 'happy' | 'eat' | 'ok' | 'hungry' | 'sad' | 'sleepy'

// 12 × 12 grids. o outline, # body, s spot, c cheek, e eye, m mouth, y star, . empty.
const SPRITES: Record<Stage, string[]> = {
  egg: [
    '....oooo....',
    '...o####o...',
    '..o######o..',
    '..o##s###o..',
    '.o####s###o.',
    '.o########o.',
    '.o##s#####o.',
    '.o#####s##o.',
    '.o########o.',
    '..o######o..',
    '...oooooo...',
    '............',
  ],
  baby: [
    '............',
    '............',
    '....oooo....',
    '..oo####oo..',
    '.o########o.',
    '.o#e####e#o.',
    'o##########o',
    'o#c##mm##c#o',
    'o##########o',
    '.o########o.',
    '..oooooooo..',
    '............',
  ],
  kid: [
    '.o........o.',
    '.oo......oo.',
    '.o#oooooo#o.',
    '.o########o.',
    'o##########o',
    'o##e####e##o',
    'o##########o',
    'o#c##mm##c#o',
    'o##########o',
    '.o########o.',
    '..o#o..o#o..',
    '..ooo..ooo..',
  ],
  adult: [
    '.....yy.....',
    '.....oo.....',
    '..oooooooo..',
    '.o########o.',
    'o##e####e##o',
    'o##########o',
    'o#c##mm##c#o',
    'o##########o',
    'o#s######s#o',
    '.o########o.',
    'o.o#o..o#o.o',
    '..ooo..ooo..',
  ],
}

const BODY: Record<Stage, { body: string; spot: string }> = {
  egg: { body: '#F4E9D0', spot: '#E0A96D' },
  baby: { body: '#8EE3C8', spot: '#5CC7A6' },
  kid: { body: '#7FC8F8', spot: '#4FA3DB' },
  adult: { body: '#B79CFF', spot: '#8E6CF0' },
}

const INK = '#16112A'
const CHEEK = '#FF9EB5'
const STAR = '#FFD84A'
const TEAR = '#6EC6FF'
const PINK = '#F4A7B9'
const COLLAR = '#E8505B'

export const STAGE_ZH: Record<Stage, string> = { egg: '蛋', baby: '幼崽', kid: '少年', adult: '成年' }
export const MOOD_ZH: Record<Mood, string> = {
  happy: '开心',
  eat: '吃饱了',
  ok: '平静',
  hungry: '饿了',
  sad: '难过',
  sleepy: '犯困',
}

export const STAGE_XP: Array<[Stage, number]> = [
  ['egg', 0],
  ['baby', 15],
  ['kid', 80],
  ['adult', 250],
]

export function stageOf(xp: number): Stage {
  let s: Stage = 'egg'
  for (const [stage, need] of STAGE_XP) if (xp >= need) s = stage
  return s
}

/** XP still needed for the next stage, or undefined at the last one. */
export function nextStage(xp: number): { stage: Stage; need: number; from: number } | undefined {
  for (let i = 0; i < STAGE_XP.length; i += 1) {
    const [stage, need] = STAGE_XP[i]!
    if (xp < need) return { stage, need, from: STAGE_XP[i - 1]?.[1] ?? 0 }
  }
  return undefined
}

export const SLEEPY_MS = 45 * 60 * 1000

export function moodOf(pet: Pet, reaction: Reaction | null, now: number): Mood {
  if (reaction?.kind === 'eat') return 'eat'
  if (reaction && (reaction.kind === 'happy' || reaction.kind === 'evolve' || reaction.kind === 'pat')) return 'happy'
  if (reaction?.kind === 'sad') return 'sad'
  if (now - pet.lastActive > SLEEPY_MS) return 'sleepy'
  if (pet.food < 25) return 'hungry'
  if (pet.joy < 30) return 'sad'
  if (pet.joy > 75 && pet.food > 60) return 'happy'
  return 'ok'
}

type Geo = { ox: number; oy: number; P: number; face: string }

function cellAt(g: Geo, x: number, y: number, fill: string): string {
  return `<rect x="${g.ox + x * g.P}" y="${g.oy + y * g.P}" width="${g.P}" height="${g.P}" fill="${fill}"/>`
}

function eye(g: Geo, x: number, y: number, mood: Mood): string {
  const cx = g.ox + x * g.P
  const cy = g.oy + y * g.P
  const u = g.P / 12
  const stroke = `stroke="${g.face}" stroke-width="${3 * u}" stroke-linecap="square" fill="none"`
  switch (mood) {
    case 'happy':
    case 'eat':
      return `<path d="M${cx + u} ${cy + 9 * u} L${cx + 6 * u} ${cy + 3 * u} L${cx + 11 * u} ${cy + 9 * u}" ${stroke}/>`
    case 'sleepy':
      return `<path d="M${cx + u} ${cy + 7 * u} H${cx + 11 * u}" ${stroke}/>`
    case 'sad':
      return `${cellAt(g, x, y, g.face)}<rect x="${cx + 3 * u}" y="${cy + g.P + 2 * u}" width="${6 * u}" height="${8 * u}" rx="${3 * u}" fill="${TEAR}"/>`
    default:
      return cellAt(g, x, y, g.face)
  }
}

function mouth(g: Geo, cells: Array<[number, number]>, mood: Mood, base: string): string {
  if (cells.length === 0) return ''
  const xs = cells.map(c => c[0])
  const y = cells[0]![1]
  const x0 = g.ox + Math.min(...xs) * g.P
  const w = cells.length * g.P
  const top = g.oy + y * g.P
  const u = g.P / 12
  const fill = cells.map(([x, yy]) => cellAt(g, x, yy, base)).join('')
  const stroke = `stroke="${g.face}" stroke-width="${3 * u}" fill="none" stroke-linecap="square"`
  // A one-cell mouth (the animals) is drawn wider than its cell.
  const l = cells.length === 1 ? x0 - 4 * u : x0 + 2 * u
  const r = cells.length === 1 ? x0 + w + 4 * u : x0 + w - 2 * u
  switch (mood) {
    case 'happy':
      return `${fill}<path d="M${l} ${top + 3 * u} Q${(l + r) / 2} ${top + 14 * u} ${r} ${top + 3 * u}" ${stroke}/>`
    case 'eat':
      return `${fill}<rect x="${l}" y="${top + u}" width="${r - l}" height="${g.P - u}" rx="${4 * u}" fill="${g.face}"/><rect x="${l + 4 * u}" y="${top + 6 * u}" width="${Math.max(2, r - l - 8 * u)}" height="${4 * u}" rx="${2 * u}" fill="${CHEEK}"/>`
    case 'sad':
    case 'hungry':
      return `${fill}<path d="M${l} ${top + 10 * u} Q${(l + r) / 2} ${top + 2 * u} ${r} ${top + 10 * u}" ${stroke}/>`
    case 'sleepy':
      return `${fill}<circle cx="${(l + r) / 2}" cy="${top + 6 * u}" r="${3 * u}" fill="${g.face}"/>`
    default:
      return `${fill}<path d="M${l} ${top + 6 * u} H${r}" ${stroke}/>`
  }
}

function extra(mood: Mood, right: number, top: number): string {
  switch (mood) {
    case 'sleepy':
      return `<text x="${right}" y="${top + 20}" font-family="monospace" font-weight="bold" font-size="18" fill="#9D8CFF">z<animate attributeName="opacity" values="0.2;1;0.2" dur="3s" repeatCount="indefinite"/></text><text x="${right + 12}" y="${top + 4}" font-family="monospace" font-weight="bold" font-size="13" fill="#9D8CFF">z</text>`
    case 'happy':
      return `<path transform="translate(${right} ${top + 4})" d="M8 14 L1 7 A4 4 0 0 1 8 2 A4 4 0 0 1 15 7 Z" fill="#FF6F91"><animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/></path>`
    case 'eat':
      return `<g transform="translate(${right} ${top + 30})"><circle cx="8" cy="10" r="8" fill="#FF5F5F"/><rect x="7" y="-2" width="2" height="6" fill="#6B4F2A"/><path d="M9 1 q6 -4 8 1 q-5 2 -8 -1z" fill="#5CC76A"/></g>`
    case 'hungry':
      return `<text x="${right}" y="${top + 24}" font-family="sans-serif" font-size="12" fill="#E8E2FF">…</text>`
    default:
      return ''
  }
}

const EGG = SPRITES.egg

/** The sprite grid and colours for the pet's kind, coat and stage. */
function spriteOf(pet: Pet): { grid: string[]; colors: Record<string, string>; face: string; collarRow?: number; scale: number } {
  const stage = stageOf(pet.xp)
  const species = isSpecies(pet.species) ? pet.species : 'bit'
  if (species === 'bit') {
    const col = BODY[stage]
    return { grid: SPRITES[stage], colors: { '#': col.body, s: col.spot, c: CHEEK, y: STAR }, face: INK, scale: 1 }
  }
  const kind = KINDS[species]
  const { coat } = coatOf(species, pet.coat)
  if (stage === 'egg') return { grid: EGG, colors: { '#': coat.w === '#FFFFFF' ? '#F4E9D0' : coat.w, s: coat.k }, face: INK, scale: 1 }
  return {
    grid: gridOf(kind.half!),
    colors: { t: coat.t, k: coat.k, w: coat.w, s: coat.s ?? coat.k, p: PINK, c: CHEEK, n: coat.face ?? INK },
    face: coat.face ?? INK,
    ...(kind.collarRow !== undefined && stage !== 'baby' ? { collarRow: kind.collarRow } : {}),
    scale: stage === 'baby' ? 0.72 : stage === 'kid' ? 0.86 : 1,
  }
}

export function petSvg(pet: Pet, mood: Mood, width: number): string {
  const W = 220
  const H = 200
  const ground = H - 30
  const { grid, colors, face, collarRow, scale } = spriteOf(pet)
  const rows = grid.length
  const cols = grid[0]!.length
  const P = Math.min(12, Math.floor(140 / Math.max(rows, cols)))
  const g: Geo = { ox: Math.round((W - cols * P) / 2) - 6, oy: ground - rows * P, P, face }
  const parts: string[] = []
  const eyes: Array<[number, number]> = []
  const mouthCells: Array<[number, number]> = []
  let mouthBase = colors.w ?? colors['#'] ?? '#FFFFFF'
  grid.forEach((row, y) => {
    ;[...row].forEach((ch, x) => {
      if (ch === '.') return
      if (ch === 'o') return void parts.push(cellAt(g, x, y, INK))
      if (ch === 'e') {
        parts.push(cellAt(g, x, y, colors.t ?? colors['#'] ?? '#FFFFFF'))
        return void eyes.push([x, y])
      }
      if (ch === 'm') {
        mouthBase = colors.w ?? colors['#'] ?? mouthBase
        return void mouthCells.push([x, y])
      }
      if (ch === 'c') {
        const base = colors.t ?? colors['#'] ?? '#FFFFFF'
        return void parts.push(cellAt(g, x, y, mood === 'sad' || mood === 'hungry' ? base : CHEEK))
      }
      parts.push(cellAt(g, x, y, colors[ch] ?? colors['#'] ?? '#FFFFFF'))
    })
  })
  // A collar for the kid and the adult, and a gold tag for the adult.
  if (collarRow !== undefined) {
    const row = grid[collarRow] ?? ''
    ;[...row].forEach((ch, x) => {
      if (ch !== '.' && ch !== 'o') parts.push(`<rect x="${g.ox + x * P}" y="${g.oy + collarRow * P + P * 0.15}" width="${P}" height="${P * 0.7}" fill="${COLLAR}"/>`)
    })
    if (stageOf(pet.xp) === 'adult') {
      const cx = g.ox + (cols / 2) * P
      parts.push(`<circle cx="${cx}" cy="${g.oy + (collarRow + 1) * P + 1}" r="${P * 0.42}" fill="${STAR}" stroke="${INK}" stroke-width="1.5"/>`)
    }
  }
  const face_ = eyes.map(([x, y]) => eye(g, x, y, mood)).join('') + mouth(g, mouthCells, mood, mouthBase)
  const bob = mood === 'sleepy' ? '6s' : mood === 'happy' || mood === 'eat' ? '1.6s' : '3.2s'
  const cx = g.ox + (cols * P) / 2
  const fit = scale === 1 ? '' : ` transform="translate(${cx} ${ground}) scale(${scale}) translate(${-cx} ${-ground})"`
  const right = g.ox + cols * P + 4
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${Math.min(width, 320)}" role="img" shape-rendering="crispEdges">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A3F86"/><stop offset="1" stop-color="#7A6BC0"/></linearGradient></defs>
<rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#sky)"/>
<circle cx="30" cy="26" r="1.5" fill="#fff" opacity=".6"/><circle cx="190" cy="40" r="1.2" fill="#fff" opacity=".5"/><circle cx="160" cy="18" r="1" fill="#fff" opacity=".7"/>
<rect x="0" y="${H - 34}" width="${W}" height="34" fill="#5E9C6E"/>
<rect x="0" y="${H - 34}" width="${W}" height="4" fill="#79B888"/>
<ellipse cx="${cx}" cy="${ground + 2}" rx="${(cols * P * scale) / 2.4}" ry="6" fill="#1A1430" opacity=".35"/>
<g>
<animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="${bob}" repeatCount="indefinite"/>
<g${fit}>${parts.join('')}${face_}</g>${extra(mood, right - (1 - scale) * (cols * P) / 2, g.oy + (1 - scale) * rows * P)}
</g>
</svg>`
}

const FACES: Record<Mood, string> = {
  happy: '(^▽^)',
  eat: '(˘ڡ˘)',
  ok: '(•ᴗ•)',
  hungry: '(•﹏•)',
  sad: '(╥_╥)',
  sleepy: '(-_-) zZ',
}

const SHELL: Record<Stage, string> = { egg: '(  🥚  )', baby: '', kid: '', adult: '★' }

const ANIMAL: Record<string, string> = { corgi: '🐕', shiba: '🐕', cat: '🐈', bunny: '🐇' }

export function petText(pet: Pet, mood: Mood): string {
  const stage = stageOf(pet.xp)
  if (stage === 'egg') return mood === 'sleepy' ? `${SHELL.egg} zZ` : SHELL.egg
  const icon = ANIMAL[pet.species] ?? ''
  return `${icon}${SHELL[stage]}${FACES[mood]}`
}

export function bar(value: number, cells = 10): string {
  const n = Math.round((Math.max(0, Math.min(100, value)) / 100) * cells)
  return '█'.repeat(n) + '░'.repeat(cells - n)
}
