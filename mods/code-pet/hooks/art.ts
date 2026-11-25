// Pixel sprites for the pet, drawn as SVG on the desktop and as text in the terminal.
import type { Pet, Reaction, Stage } from '../types'

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

const P = 12 // pixel size
const OX = 34 // sprite left offset in the card
const OY = 22

function cell(x: number, y: number, fill: string): string {
  return `<rect x="${OX + x * P}" y="${OY + y * P}" width="${P}" height="${P}" fill="${fill}"/>`
}

function eye(x: number, y: number, mood: Mood): string {
  const cx = OX + x * P
  const cy = OY + y * P
  const stroke = `stroke="${INK}" stroke-width="3" stroke-linecap="square" fill="none"`
  switch (mood) {
    case 'happy':
    case 'eat':
      return `<path d="M${cx + 1} ${cy + 9} L${cx + 6} ${cy + 3} L${cx + 11} ${cy + 9}" ${stroke}/>`
    case 'sleepy':
      return `<path d="M${cx + 1} ${cy + 7} H${cx + 11}" ${stroke}/>`
    case 'sad':
      return `${cell(x, y, INK)}<rect x="${cx + 3}" y="${cy + P + 2}" width="6" height="8" rx="3" fill="${TEAR}"/>`
    default:
      return cell(x, y, INK)
  }
}

function mouth(cells: Array<[number, number]>, mood: Mood): string {
  if (cells.length === 0) return ''
  const xs = cells.map(c => c[0])
  const y = cells[0]![1]
  const x0 = OX + Math.min(...xs) * P
  const w = cells.length * P
  const top = OY + y * P
  const stroke = `stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="square"`
  switch (mood) {
    case 'happy':
      return `<path d="M${x0 + 1} ${top + 3} Q${x0 + w / 2} ${top + 14} ${x0 + w - 1} ${top + 3}" ${stroke}/>`
    case 'eat':
      return `<rect x="${x0 + 2}" y="${top + 1}" width="${w - 4}" height="${P - 1}" rx="4" fill="${INK}"/><rect x="${x0 + 6}" y="${top + 6}" width="${w - 12}" height="4" rx="2" fill="${CHEEK}"/>`
    case 'sad':
    case 'hungry':
      return `<path d="M${x0 + 2} ${top + 10} Q${x0 + w / 2} ${top + 2} ${x0 + w - 2} ${top + 10}" ${stroke}/>`
    case 'sleepy':
      return `<circle cx="${x0 + w / 2}" cy="${top + 6}" r="3" fill="${INK}"/>`
    default:
      return `<path d="M${x0 + 2} ${top + 6} H${x0 + w - 2}" ${stroke}/>`
  }
}

function extra(mood: Mood): string {
  const right = OX + 12 * P + 4
  switch (mood) {
    case 'sleepy':
      return `<text x="${right}" y="${OY + 20}" font-family="monospace" font-weight="bold" font-size="18" fill="#9D8CFF">z<animate attributeName="opacity" values="0.2;1;0.2" dur="3s" repeatCount="indefinite"/></text><text x="${right + 12}" y="${OY + 4}" font-family="monospace" font-weight="bold" font-size="13" fill="#9D8CFF">z</text>`
    case 'happy':
      return `<path transform="translate(${right} ${OY + 4})" d="M8 14 L1 7 A4 4 0 0 1 8 2 A4 4 0 0 1 15 7 Z" fill="#FF6F91"><animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/></path>`
    case 'eat':
      return `<g transform="translate(${right} ${OY + 30})"><circle cx="8" cy="10" r="8" fill="#FF5F5F"/><rect x="7" y="-2" width="2" height="6" fill="#6B4F2A"/><path d="M9 1 q6 -4 8 1 q-5 2 -8 -1z" fill="#5CC76A"/></g>`
    case 'hungry':
      return `<text x="${right}" y="${OY + 24}" font-family="sans-serif" font-size="12" fill="#B1A4CC">…</text>`
    default:
      return ''
  }
}

export function petSvg(pet: Pet, mood: Mood, width: number): string {
  const stage = stageOf(pet.xp)
  const grid = SPRITES[stage]
  const col = BODY[stage]
  const parts: string[] = []
  const eyes: Array<[number, number]> = []
  const mouthCells: Array<[number, number]> = []
  grid.forEach((row, y) => {
    ;[...row].forEach((ch, x) => {
      if (ch === '.') return
      if (ch === 'o') parts.push(cell(x, y, INK))
      else if (ch === 'y') parts.push(cell(x, y, STAR))
      else if (ch === 's') parts.push(cell(x, y, col.spot))
      else if (ch === 'c') parts.push(cell(x, y, mood === 'sad' || mood === 'hungry' ? col.body : CHEEK))
      else {
        parts.push(cell(x, y, col.body))
        if (ch === 'e') eyes.push([x, y])
        if (ch === 'm') mouthCells.push([x, y])
      }
    })
  })
  const face = eyes.map(([x, y]) => eye(x, y, mood)).join('') + mouth(mouthCells, mood)
  const bob = mood === 'sleepy' ? '6s' : mood === 'happy' || mood === 'eat' ? '1.6s' : '3.2s'
  const W = 220
  const H = 200
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${Math.min(width, 320)}" role="img" shape-rendering="crispEdges">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A3F86"/><stop offset="1" stop-color="#7A6BC0"/></linearGradient></defs>
<rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#sky)"/>
<circle cx="30" cy="26" r="1.5" fill="#fff" opacity=".6"/><circle cx="190" cy="40" r="1.2" fill="#fff" opacity=".5"/><circle cx="160" cy="18" r="1" fill="#fff" opacity=".7"/>
<rect x="0" y="${H - 34}" width="${W}" height="34" fill="#5E9C6E"/>
<rect x="0" y="${H - 34}" width="${W}" height="4" fill="#79B888"/>
<ellipse cx="${OX + 6 * P}" cy="${OY + 12 * P + 6}" rx="56" ry="7" fill="#1A1430" opacity=".35"/>
<g>
<animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="${bob}" repeatCount="indefinite"/>
${parts.join('')}${face}${extra(mood)}
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

export function petText(pet: Pet, mood: Mood): string {
  const stage = stageOf(pet.xp)
  if (stage === 'egg') return mood === 'sleepy' ? `${SHELL.egg} zZ` : SHELL.egg
  return `${SHELL[stage]}${FACES[mood]}`
}

export function bar(value: number, cells = 10): string {
  const n = Math.round((Math.max(0, Math.min(100, value)) / 100) * cells)
  return '█'.repeat(n) + '░'.repeat(cells - n)
}
