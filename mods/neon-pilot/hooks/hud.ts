// Pure drawing helpers for NEON PILOT: palette, stage logic and the cockpit
// dashboard, drawn as one SVG that fills the side panel. No `$` here.
import type { Flash, FlashKind, Hud, Stage } from '../types'

export const C = {
  bg: '#07060D',
  panel: '#0C0914',
  plate: '#120E20',
  cyan: '#2EF2FF',
  magenta: '#FF2E88',
  yellow: '#FFD84A',
  text: '#F2ECFF',
  dim: '#B1A4CC',
  border: '#3A2C55',
  off: '#2A1F3D',
} as const

const MONO = "'Share Tech Mono','SF Mono',Menlo,'Noto Sans SC','PingFang SC',monospace"
const HEAD = "Rajdhani,'DIN Condensed','Avenir Next Condensed','Noto Sans SC','PingFang SC',sans-serif"
const CJK = "'Noto Sans SC','PingFang SC','Hiragino Sans GB',sans-serif"

export const STAGE_ZH: Record<Stage, string> = {
  STANDBY: '待机',
  LINKED: '链接',
  OVERDRIVE: '超频',
  CRITICAL: '临界',
}

export function stageOf(hud: Hud): Stage {
  if (hud.isLong || hud.pct > 90) return 'CRITICAL'
  if (hud.pct >= 70) return 'OVERDRIVE'
  if (hud.pct >= 30) return 'LINKED'
  return 'STANDBY'
}

export function stageColor(stage: Stage): string {
  return stage === 'CRITICAL' ? C.magenta : C.cyan
}

export const FLASH: Record<FlashKind, { code: string; title: string; zh: string; fg: string; fill: number }> = {
  green: { code: '// CHECK', title: 'ALL GREEN', zh: '全部通过', fg: C.cyan, fill: 10 },
  launch: { code: '// SORTIE', title: 'LAUNCH', zh: '出击', fg: C.magenta, fill: 10 },
  clear: { code: '// MISSION', title: 'MISSION CLEAR', zh: '任务完成', fg: C.cyan, fill: 10 },
  check: { code: '// PRE-LAUNCH', title: 'SYSTEM CHECK', zh: '出击前自检', fg: C.yellow, fill: 6 },
}

export const BAR_CELLS = 20

/** The 20-cell load bar as text, for the terminal. */
export function barText(pct: number): string {
  const lit = Math.max(0, Math.min(BAR_CELLS, Math.round(pct / 5)))
  return '▰'.repeat(lit) + '▱'.repeat(BAR_CELLS - lit)
}

export function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const kfmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

export function dur(ms: number): string {
  if (ms <= 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

function resetText(at: string | undefined, now: number): string {
  if (!at) return ''
  const t = Date.parse(at)
  if (!Number.isFinite(t)) return ''
  const ms = t - now
  if (ms <= 0) return 'RESET NOW'
  const h = Math.floor(ms / 3600000)
  const m = Math.round((ms % 3600000) / 60000)
  return h >= 24 ? `RESET T-${Math.round(h / 24)}D` : `RESET T-${h}H${String(m).padStart(2, '0')}M`
}

const LIMIT_NAMES: Record<string, string> = {
  five_hour: '5H LIMIT',
  seven_day: '7D LIMIT',
  seven_day_opus: '7D OPUS',
  spend_limit: 'SPEND',
}

/** A rectangle with its top-left and bottom-right corners cut: the HUD plate. */
function plate(x: number, y: number, w: number, h: number, cut: number): string {
  return [
    `${x + cut},${y}`,
    `${x + w},${y}`,
    `${x + w},${y + h - cut}`,
    `${x + w - cut},${y + h}`,
    `${x},${y + h}`,
    `${x},${y + cut}`,
  ].join(' ')
}

function cells(x: number, y: number, w: number, h: number, n: number, lit: number, on: string): string {
  const gap = 3
  const cw = (w - gap * (n - 1)) / n
  let s = ''
  for (let i = 0; i < n; i++) {
    s += `<rect x="${(x + i * (cw + gap)).toFixed(1)}" y="${y}" width="${cw.toFixed(1)}" height="${h}" fill="${i < lit ? on : C.off}"/>`
  }
  return s
}

export const DASH_W = 360
export const CELL_ASPECT = 2.3

/** The panel's height in SVG units for a body of `columns` x `rows` cells. */
export function dashHeight(columns: number, rows: number): number {
  if (!columns || !rows) return 0
  return Math.round(Math.min(2400, (DASH_W * rows * CELL_ASPECT) / columns))
}

/**
 * The cockpit dashboard: the illustration in a bracketed frame (it takes the
 * panel's spare height), any mission alert, the stage and LINK bar, telemetry
 * and the usage windows.
 */
export function cockpitSvg(hud: Hud, flash: Flash | null, img: string, now: number, H0: number): string {
  const stage = stageOf(hud)
  const sc = stageColor(stage)
  const isCrit = stage === 'CRITICAL'
  const anim = isCrit ? 'blink' : stage === 'OVERDRIVE' ? 'pulse' : ''
  const W = DASH_W
  const x = 14
  const w = W - 28

  // fixed blocks, top to bottom
  const headH = 58
  const flashH = 0 // the alert card overlays the art's foot
  const stageH = 132
  const rows: Array<[string, string]> = [
    ['MODEL', hud.model],
    ['REPO', hud.repo],
    ['BRANCH', hud.branch],
    ['TURNS', String(hud.turns)],
    ['TOOL CALLS', String(hud.tools)],
    ['LAST TURN', dur(hud.lastTurnMs)],
    ['SESSION', hud.startedAt ? dur(now - hud.startedAt) : '—'],
  ]
  const rowH = 27
  const teleH = 34 + rows.length * rowH + 20
  const limits = hud.limits.slice(0, 3)
  const usageH = 34 + Math.max(1, limits.length) * 46 + 44
  const fixed = headH + 12 + flashH + stageH + teleH + usageH + 2
  const artH = Math.max(150, (H0 || 0) - fixed)
  const H = fixed + artH

  let y = 0
  let s = ''
  // header
  s +=
    `<text x="${x}" y="30" font-family="${HEAD}" font-size="25" font-weight="700" letter-spacing="2" fill="${C.cyan}">NEON <tspan fill="${C.magenta}">PILOT</tspan></text>` +
    `<text x="${x}" y="48" font-family="${MONO}" font-size="10.5" letter-spacing="2" fill="${C.dim}">KX-07 // COCKPIT · 驾驶舱</text>` +
    `<g class="${anim}">` +
    `<polygon points="${plate(W - 14 - 118, 14, 118, 30, 7)}" fill="${C.plate}" stroke="${sc}" stroke-width="1.5"/>` +
    `<circle cx="${W - 14 - 104}" cy="29" r="3.5" fill="${sc}"/>` +
    `<text x="${W - 14 - 94}" y="34" font-family="${HEAD}" font-size="14" font-weight="700" letter-spacing="1" fill="${sc}">${stage}</text>` +
    `<text x="${W - 22}" y="34" text-anchor="end" font-family="${CJK}" font-size="11" font-weight="700" fill="${sc}">${STAGE_ZH[stage]}</text>` +
    '</g>'
  y = headH

  // illustration
  s +=
    `<clipPath id="art"><polygon points="${plate(x, y, w, artH, 14)}"/></clipPath>` +
    `<g clip-path="url(#art)"><rect x="${x}" y="${y}" width="${w}" height="${artH}" fill="${C.panel}"/>` +
    `<image href="${img}" x="${x}" y="${y}" width="${w}" height="${artH}" preserveAspectRatio="xMidYMin slice"/>` +
    `<rect x="${x}" y="${y + artH - 60}" width="${w}" height="60" fill="url(#artfade)"/></g>` +
    `<path d="M${x + 6} ${y + 30}V${y + 6}H${x + 30}M${x + w - 6} ${y + 30}V${y + 6}H${x + w - 30}M${x + 6} ${y + artH - 30}V${y + artH - 6}H${x + 30}M${x + w - 6} ${y + artH - 30}V${y + artH - 6}H${x + w - 30}" stroke="${sc}" stroke-width="2" fill="none"/>` +
    `<text x="${x + 16}" y="${y + artH - 14}" font-family="${MONO}" font-size="10" letter-spacing="2" fill="${sc}">// PILOT LINK · KX-07</text>`
  // mission alert, over the foot of the art
  if (flash) {
    const f = FLASH[flash.kind]
    const fh = 92
    y = y + artH - fh - 8
    s +=
      `<polygon points="${plate(x, y, w, fh, 10)}" fill="${C.panel}" stroke="${f.fg}" stroke-width="1.2" filter="url(#g)"/>` +
      `<rect x="${x}" y="${y + 10}" width="4" height="${fh - 10}" fill="${f.fg}"/>` +
      `<text x="${x + 16}" y="${y + 18}" font-family="${MONO}" font-size="10" letter-spacing="1.5" fill="${f.fg}">${esc(f.code)}</text>` +
      `<text x="${x + w - 12}" y="${y + 18}" text-anchor="end" font-family="${MONO}" font-size="10" fill="${C.dim}">${esc(clip(flash.detail, 26))}</text>` +
      `<text x="${x + 16}" y="${y + 44}" font-family="${HEAD}" font-size="23" font-weight="700" letter-spacing="1.5" fill="${f.fg}">${esc(f.title)} <tspan font-family="${CJK}" font-size="13" font-weight="500" fill="${C.text}">${esc(f.zh)}</tspan></text>` +
      `<text x="${x + 16}" y="${y + 64}" font-family="${CJK}" font-size="11.5" fill="#D6CCEA">${esc(clip(flash.sub, 30))}</text>` +
      cells(x + 16, y + fh - 14, w - 32, 4, 10, f.fill, f.fg)
    y += fh + 8 - artH
  }
  y += artH + 12

  // stage + LINK
  s +=
    `<polygon points="${plate(x, y, w, stageH - 12, 10)}" fill="${C.plate}" stroke="${isCrit ? C.magenta : C.border}" stroke-width="1"/>` +
    `<text x="${x + 16}" y="${y + 22}" font-family="${MONO}" font-size="10" letter-spacing="2.5" fill="${C.dim}">SYSTEM STAGE</text>` +
    `<g class="${anim}">` +
    `<text x="${x + 14}" y="${y + 60}" font-family="${HEAD}" font-size="40" font-weight="700" letter-spacing="3" fill="${sc}">${stage}</text>` +
    `<text x="${x + w - 16}" y="${y + 58}" text-anchor="end" font-family="${CJK}" font-size="22" font-weight="700" fill="${sc}">${STAGE_ZH[stage]}</text>` +
    cells(x + 16, y + 74, w - 32, 12, BAR_CELLS, Math.round(Math.min(100, hud.pct) / 5), sc) +
    '</g>' +
    `<text x="${x + 16}" y="${y + 106}" font-family="${MONO}" font-size="11" font-weight="700" fill="${sc}">LINK ${hud.pct}%</text>` +
    `<text x="${x + w - 16}" y="${y + 106}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.dim}">${hud.window ? `${kfmt(hud.tokens)} / ${kfmt(hud.window)} TOKENS` : ''}</text>`
  y += stageH

  // telemetry
  s +=
    `<polygon points="${plate(x, y, w, teleH - 12, 10)}" fill="${C.plate}" stroke="${C.border}" stroke-width="1"/>` +
    `<text x="${x + 16}" y="${y + 22}" font-family="${MONO}" font-size="10" letter-spacing="2.5" fill="${C.cyan}">TELEMETRY</text>`
  rows.forEach(([k, v], i) => {
    const ry = y + 34 + i * rowH
    s +=
      `<line x1="${x + 16}" y1="${ry}" x2="${x + w - 16}" y2="${ry}" stroke="${C.off}" stroke-width="1"/>` +
      `<text x="${x + 16}" y="${ry + 18}" font-family="${MONO}" font-size="10.5" letter-spacing="1.5" fill="${C.dim}">${k}</text>` +
      `<text x="${x + w - 16}" y="${ry + 18}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${C.text}">${esc(clip(v, 24))}</text>`
  })
  y += teleH

  // usage
  s +=
    `<polygon points="${plate(x, y, w, usageH - 12, 10)}" fill="${C.plate}" stroke="${C.border}" stroke-width="1"/>` +
    `<text x="${x + 16}" y="${y + 22}" font-family="${MONO}" font-size="10" letter-spacing="2.5" fill="${C.cyan}">FUEL · USAGE</text>`
  let uy = y + 34
  if (limits.length === 0) {
    s += `<text x="${x + 16}" y="${uy + 22}" font-family="${MONO}" font-size="11" fill="${C.dim}">NO RATE-LIMIT READING YET</text>`
    uy += 46
  }
  for (const l of limits) {
    const col = l.pct > 90 ? C.magenta : C.cyan
    s +=
      `<text x="${x + 16}" y="${uy + 14}" font-family="${MONO}" font-size="10.5" letter-spacing="1.5" fill="${C.dim}">${esc(LIMIT_NAMES[l.kind] ?? l.kind.toUpperCase())}</text>` +
      `<text x="${x + w - 16}" y="${uy + 14}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${C.text}">${l.pct}%</text>` +
      cells(x + 16, uy + 21, w - 32, 6, BAR_CELLS, Math.round(Math.min(100, l.pct) / 5), col) +
      `<text x="${x + 16}" y="${uy + 40}" font-family="${MONO}" font-size="9.5" letter-spacing="1" fill="${C.dim}">${esc(resetText(l.resetsAt, now))}</text>`
    uy += 46
  }
  s +=
    `<line x1="${x + 16}" y1="${uy + 2}" x2="${x + w - 16}" y2="${uy + 2}" stroke="${C.off}" stroke-width="1"/>` +
    `<text x="${x + 16}" y="${uy + 22}" font-family="${MONO}" font-size="10.5" letter-spacing="1.5" fill="${C.dim}">SESSION COST</text>` +
    `<text x="${x + w - 16}" y="${uy + 22}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${C.text}">${hud.usd === undefined ? '—' : `$${hud.usd.toFixed(2)}`}</text>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    '<style>' +
    '@keyframes p{0%,100%{opacity:.6}50%{opacity:1}}' +
    '@keyframes b{0%,49%{opacity:1}50%,100%{opacity:.3}}' +
    '.pulse{animation:p 1.6s ease-in-out infinite}' +
    '.blink{animation:b .9s linear infinite}' +
    '</style>' +
    '<defs>' +
    `<linearGradient id="artfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg}" stop-opacity="0"/><stop offset="1" stop-color="${C.bg}" stop-opacity=".9"/></linearGradient>` +
    `<filter id="g" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${flash ? FLASH[flash.kind].fg : C.cyan}" flood-opacity=".35"/></filter>` +
    '</defs>' +
    `<rect width="${W}" height="${H}" fill="${C.bg}"/>` +
    s +
    '</svg>'
  )
}
