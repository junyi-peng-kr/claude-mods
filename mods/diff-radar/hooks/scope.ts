// The radar scope: changed files as blips. No `$` here.
//  - angle: the file's folder (files of one folder sit in one sector)
//  - distance: how recently Claude edited it (fresh edits near the centre,
//    files changed but untouched this session on the rim)
//  - size: lines changed; colour: how many times it was edited this session
import type { Change, EditCount, Radar } from '../types'

export const C = {
  bg: '#07060D',
  ring: '#16404A',
  grid: '#0F2A31',
  cyan: '#2EF2FF',
  yellow: '#FFD84A',
  magenta: '#FF2E88',
  cold: '#6C7A99',
  text: '#F2ECFF',
  dim: '#B1A4CC',
} as const

const MONO = "'Share Tech Mono','SF Mono',Menlo,'Noto Sans SC','PingFang SC',monospace"

export type Blip = Change & { edits: number; last: number; heat: Heat }

export type Heat = 'hot' | 'warm' | 'touched' | 'cold'

export function heatOf(edits: number, threshold: number): Heat {
  if (edits >= threshold) return 'hot'
  if (edits >= Math.ceil(threshold / 2)) return 'warm'
  if (edits >= 1) return 'touched'
  return 'cold'
}

export const HEAT_COLOR: Record<Heat, string> = { hot: C.magenta, warm: C.yellow, touched: C.cyan, cold: C.cold }

export const HEAT_GLYPH: Record<Heat, string> = { hot: '◉', warm: '●', touched: '•', cold: '·' }

/** The changed files with their edit counts, hottest first. */
export function blipsOf(radar: Radar): Blip[] {
  return radar.changes
    .map(c => {
      const e: EditCount = radar.edits[c.path] ?? { count: 0, last: 0 }
      return { ...c, edits: e.count, last: e.last, heat: heatOf(e.count, radar.threshold) }
    })
    .sort((a, b) => b.edits - a.edits || b.add + b.del - (a.add + a.del) || a.path.localeCompare(b.path))
}

export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const base = (p: string) => p.split('/').filter(Boolean).pop() ?? p
const dir = (p: string) => p.split('/').slice(0, -1).join('/') || '.'

const FRESH_MS = 30 * 60 * 1000

export function scopeSvg(radar: Radar, now: number, width: number): string {
  const W = 320
  const cx = 160
  const cy = 168
  const R = 136
  const blips = blipsOf(radar)
  const add = radar.changes.reduce((n, c) => n + c.add, 0)
  const del = radar.changes.reduce((n, c) => n + c.del, 0)
  const hot = blips.filter(b => b.heat === 'hot').length

  let s = ''
  // Rings, cross hairs and bearing ticks.
  for (const r of [R * 0.25, R * 0.5, R * 0.75, R]) {
    s += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${C.ring}" stroke-width="${r === R ? 1.5 : 1}"/>`
  }
  s += `<path d="M${cx - R} ${cy}H${cx + R}M${cx} ${cy - R}V${cy + R}" stroke="${C.grid}" stroke-width="1"/>`
  for (let a = 0; a < 360; a += 15) {
    const t = (a * Math.PI) / 180
    const r1 = a % 45 === 0 ? R - 9 : R - 5
    s += `<line x1="${(cx + Math.cos(t) * r1).toFixed(1)}" y1="${(cy + Math.sin(t) * r1).toFixed(1)}" x2="${(cx + Math.cos(t) * R).toFixed(1)}" y2="${(cy + Math.sin(t) * R).toFixed(1)}" stroke="${C.ring}" stroke-width="1"/>`
  }
  // The sweep: a fading wedge turning once every 6 s.
  s +=
    `<g><animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="6s" repeatCount="indefinite"/>` +
    `<path d="M${cx} ${cy}L${cx + R} ${cy}A${R} ${R} 0 0 0 ${(cx + Math.cos(-0.7) * R).toFixed(1)} ${(cy + Math.sin(-0.7) * R).toFixed(1)}Z" fill="url(#sweep)"/>` +
    `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${C.cyan}" stroke-width="1.5" stroke-opacity=".8"/></g>`

  // Blips.
  const labelled = new Set(blips.slice(0, 6).map(b => b.path))
  for (const b of [...blips].reverse()) {
    const angle = ((hash(dir(b.path)) % 360) + ((hash(b.path) % 40) - 20)) * (Math.PI / 180)
    const jitter = (hash(`${b.path}#r`) % 12) - 6
    const r = b.last > 0 ? R * 0.18 + Math.min(1, (now - b.last) / FRESH_MS) * R * 0.55 + jitter : R * 0.86 + jitter * 0.6
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    const size = 3 + Math.min(8, Math.sqrt(b.add + b.del) / 2)
    const col = HEAT_COLOR[b.heat]
    const tip = esc(`${b.path}\n+${b.add} −${b.del}${b.isNew ? ' · 新文件' : ''} · 本次会话改了 ${b.edits} 次`)
    s += `<g><title>${tip}</title>`
    if (b.heat === 'hot') {
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="none" stroke="${col}" stroke-width="1.5"><animate attributeName="r" values="${size.toFixed(1)};${(size + 10).toFixed(1)}" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0" dur="1.4s" repeatCount="indefinite"/></circle>`
    }
    s += b.isNew
      ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="${C.bg}" stroke="${col}" stroke-width="2"/>`
      : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="${col}" fill-opacity="${b.heat === 'cold' ? 0.6 : 0.95}"/>`
    if (labelled.has(b.path)) {
      const left = x > cx
      s += `<text x="${(x + (left ? -(size + 4) : size + 4)).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${left ? 'end' : 'start'}" font-family="${MONO}" font-size="9.5" fill="${col}">${esc(base(b.path).slice(0, 22))}${b.edits > 1 ? ` ×${b.edits}` : ''}</text>`
    }
    s += '</g>'
  }
  if (blips.length === 0) {
    s += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${C.dim}">${radar.root ? 'NO CONTACT · 工作区干净' : 'NO REPO · 不在 git 仓库里'}</text>`
  }
  s += `<circle cx="${cx}" cy="${cy}" r="3" fill="${C.cyan}"/>`

  // Header.
  const head =
    `<text x="12" y="20" font-family="${MONO}" font-size="12" font-weight="bold" letter-spacing="2" fill="${C.cyan}">DIFF RADAR</text>` +
    `<text x="${W - 12}" y="20" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.text}">${blips.length} FILES <tspan fill="#7CFFB2">+${add}</tspan> <tspan fill="${C.magenta}">−${del}</tspan>${hot ? ` <tspan fill="${C.magenta}">· ${hot} HOT</tspan>` : ''}</text>`

  // Legend.
  const ly = cy + R + 20
  const legend = (['touched', 'warm', 'hot', 'cold'] as const)
    .map((h, i) => {
      const label = { touched: '改过', warm: `改了 ${Math.ceil(radar.threshold / 2)}+ 次`, hot: `${radar.threshold}+ 次`, cold: '本次没碰' }[h]
      const lx = 14 + i * 76
      return `<circle cx="${lx + 4}" cy="${ly - 3}" r="4" fill="${HEAT_COLOR[h]}"/><text x="${lx + 12}" y="${ly}" font-family="${MONO}" font-size="9" fill="${C.dim}">${label}</text>`
    })
    .join('')
  const H = ly + 14

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${Math.min(width, 420)}">` +
    `<defs><linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".02"/><stop offset="1" stop-color="${C.cyan}" stop-opacity=".28"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" rx="12" fill="${C.bg}"/>${head}${s}${legend}</svg>`
  )
}
