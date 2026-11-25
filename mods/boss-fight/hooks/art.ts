// The boss, drawn from its seed: a mirrored pixel monster with an HP bar.
import type { Battle, Boss, Tier } from '../types'

export const KINDS = ['史莱姆', '骷髅骑士', '深渊之眼', '机械巨像', '炎龙', '幽灵', '石像鬼', '毒蘑菇王']

export const TIER_ZH: Record<Tier, string> = { minion: '小怪', elite: '精英', overlord: '魔王' }

export function tierOf(hp: number): Tier {
  return hp >= 10 ? 'overlord' : hp >= 3 ? 'elite' : 'minion'
}

const PALETTE: Record<Tier, { body: string; dark: string; glow: string }> = {
  minion: { body: '#7BD389', dark: '#3E8E55', glow: '#C9F7D2' },
  elite: { body: '#FF9F43', dark: '#B85C10', glow: '#FFE0B8' },
  overlord: { body: '#E84A5F', dark: '#8E1F33', glow: '#FFC2CC' },
}

function rng(seed: number) {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 13 // sprite columns (odd: a centre column)
const H = 12

/** 0 empty, 1 body, 2 dark, 3 eye, 4 mouth. Mirrored around the centre column. */
export function spriteOf(seed: number, tier: Tier): number[][] {
  const r = rng(seed)
  const half = Math.ceil(W / 2)
  const grid: number[][] = []
  for (let y = 0; y < H; y += 1) {
    const row: number[] = []
    for (let x = 0; x < half; x += 1) {
      const dx = (half - 1 - x) / half // 0 at centre, ~1 at edge
      const dy = Math.abs(y - H * 0.5) / (H * 0.5)
      const p = 0.95 - dx * 0.75 - dy * 0.45
      row.push(r() < p ? (r() < 0.22 ? 2 : 1) : 0)
    }
    grid.push(row)
  }
  // A solid core so the boss is never a scatter of pixels.
  for (let y = 3; y < H - 2; y += 1) for (let x = half - 3; x < half; x += 1) grid[y]![x] = grid[y]![x] || 1
  // Horns for the bigger ones.
  if (tier !== 'minion') {
    const hx = half - 3 - Math.floor(r() * 2)
    grid[0]![hx] = 2
    grid[1]![hx] = 2
    grid[1]![hx + 1] = 1
  }
  // Eyes and mouth.
  const ey = 4 + Math.floor(r() * 2)
  grid[ey]![half - 3] = 3
  if (tier === 'overlord') grid[ey - 1]![half - 1] = 3
  grid[ey + 3]![half - 1] = 4
  grid[ey + 3]![half - 2] = 4
  // Mirror.
  return grid.map(row => [...row, ...row.slice(0, half - 1).reverse()])
}

const hpColor = (pct: number) => (pct > 0.5 ? '#E84A5F' : pct > 0.2 ? '#FF9F43' : '#FFD84A')

export function bossSvg(battle: Battle, width: number, now: number): string {
  const last = battle.log[battle.log.length - 1]
  const isHit = (last?.kind === 'hit' || last?.kind === 'win') && now - last.at < 2500
  const VW = 260
  const VH = 230
  const boss = battle.boss
  const bg = `<rect width="${VW}" height="${VH}" rx="14" fill="#14101F"/>
<rect y="${VH - 46}" width="${VW}" height="46" fill="#221A36"/>
<path d="M0 ${VH - 46} H${VW}" stroke="#3A2C55" stroke-width="2"/>`
  if (!boss) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${Math.min(width, 340)}">${bg}
<g transform="translate(${VW / 2} ${VH / 2 - 10})" fill="none" stroke="#7BD389" stroke-width="4" stroke-linecap="round">
<path d="M-26 0 L-8 18 L28 -20"/></g>
<text x="${VW / 2}" y="${VH - 18}" text-anchor="middle" font-family="monospace" font-size="13" fill="#B1A4CC">一片和平 · 没有 Boss</text></svg>`
  }
  const P = 12
  const grid = spriteOf(boss.seed, boss.tier)
  const col = PALETTE[boss.tier]
  const ox = (VW - W * P) / 2
  const oy = 34
  const isDead = battle.status === 'won'
  const isGone = battle.status === 'fled'
  const cells: string[] = []
  grid.forEach((row, y) =>
    row.forEach((v, x) => {
      if (!v) return
      const fill = v === 1 ? col.body : v === 2 ? col.dark : v === 3 ? (isDead ? '#14101F' : '#FFF6A8') : '#14101F'
      cells.push(`<rect x="${ox + x * P}" y="${oy + y * P}" width="${P}" height="${P}" fill="${fill}"/>`)
    }),
  )
  if (isDead) {
    // Crossed-out eyes.
    grid.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v !== 3) return
        const cx = ox + x * P
        const cy = oy + y * P
        cells.push(
          `<path d="M${cx} ${cy} L${cx + P} ${cy + P} M${cx + P} ${cy} L${cx} ${cy + P}" stroke="#FFF6A8" stroke-width="2.5"/>`,
        )
      }),
    )
  }
  const pct = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0
  const barW = VW - 40
  const hit =
    isHit
      ? `<animateTransform attributeName="transform" type="translate" values="0 0;-7 0;6 0;-4 0;0 0" dur="0.45s" begin="0s" repeatCount="1"/>`
      : `<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="2.4s" repeatCount="indefinite"/>`
  const flash =
    isHit
      ? `<rect width="${VW}" height="${VH}" rx="14" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;0.35;0" dur="0.3s" repeatCount="1"/></rect>`
      : ''
  const banner = isDead
    ? `<g><rect x="30" y="${VH / 2 - 22}" width="${VW - 60}" height="40" rx="6" fill="#FFD84A"/><text x="${VW / 2}" y="${VH / 2 + 6}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="20" fill="#14101F">VICTORY · 击败</text></g>`
    : isGone
      ? `<text x="${VW / 2}" y="${VH / 2}" text-anchor="middle" font-family="monospace" font-size="16" fill="#B1A4CC">撤退了……</text>`
      : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${Math.min(width, 340)}" shape-rendering="crispEdges">${bg}
<rect x="20" y="12" width="${barW}" height="12" rx="3" fill="#2A1F3D"/>
<rect x="20" y="12" width="${Math.max(0, barW * pct)}" height="12" rx="3" fill="${hpColor(pct)}"/>
<text x="${VW - 22}" y="22" text-anchor="end" font-family="monospace" font-size="10" font-weight="bold" fill="#14101F">${boss.hp}/${boss.maxHp}</text>
<ellipse cx="${VW / 2}" cy="${oy + H * P + 6}" rx="${(W * P) / 2}" ry="8" fill="#000" opacity=".45"/>
<g opacity="${isDead || isGone ? 0.35 : 1}">${hit}${cells.join('')}</g>
${!isDead && !isGone ? `<circle cx="${VW / 2}" cy="${oy + (H * P) / 2}" r="${(W * P) / 2 + 10}" fill="none" stroke="${col.glow}" stroke-opacity=".12" stroke-width="6"/>` : ''}
${banner}${flash}
</svg>`
}

export function hpBar(boss: Boss, cells = 16): string {
  const n = boss.maxHp > 0 ? Math.round((boss.hp / boss.maxHp) * cells) : 0
  return '█'.repeat(n) + '░'.repeat(cells - n)
}

export function fmtMs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m` : `${m}:${String(s % 60).padStart(2, '0')}`
}

// ── mecha mode: when NEON PILOT's look is on, KX-07 fights the boss ─────────
const N = {
  bg: '#07060D',
  plate: '#120E20',
  cyan: '#2EF2FF',
  magenta: '#FF2E88',
  yellow: '#FFD84A',
  text: '#F2ECFF',
  dim: '#B1A4CC',
  off: '#2A1F3D',
  border: '#3A2C55',
}
const MONO = "'Share Tech Mono','SF Mono',Menlo,'Noto Sans SC','PingFang SC',monospace"
const HEAD = "Rajdhani,'DIN Condensed','Avenir Next Condensed','Noto Sans SC','PingFang SC',sans-serif"

const plate = (x: number, y: number, w: number, h: number, c: number) =>
  `${x + c},${y} ${x + w},${y} ${x + w},${y + h - c} ${x + w - c},${y + h} ${x},${y + h} ${x},${y + c}`

function cellBar(x: number, y: number, w: number, h: number, n: number, lit: number, on: string): string {
  const gap = 2
  const cw = (w - gap * (n - 1)) / n
  let s = ''
  for (let i = 0; i < n; i += 1) {
    s += `<rect x="${(x + i * (cw + gap)).toFixed(1)}" y="${y}" width="${cw.toFixed(1)}" height="${h}" fill="${i < lit ? on : N.off}"/>`
  }
  return s
}

/** KX-07 from the waist up, facing right, its arm cannon's muzzle at (178, 171). */
const KX07 =
  `<g stroke="${N.cyan}" stroke-width="1.4" stroke-linejoin="round" fill="${N.plate}">` +
  `<polygon points="34,250 50,196 108,196 124,250"/>` +
  `<polygon points="44,200 58,164 100,164 114,200 96,214 62,214"/>` +
  `<polygon points="14,168 52,160 48,196 10,204"/>` +
  `<polygon points="104,160 140,166 144,200 108,196"/>` +
  `<polygon points="118,168 176,162 180,172 176,180 120,184"/>` +
  `<polygon points="58,112 98,112 110,134 100,156 56,156 46,134"/>` +
  `<polyline points="64,112 70,96 76,112" fill="none"/>` +
  `</g>` +
  `<rect x="62" y="128" width="40" height="6" fill="${N.cyan}"><animate attributeName="opacity" values="0.55;1;0.55" dur="3s" repeatCount="indefinite"/></rect>` +
  `<rect x="72" y="176" width="14" height="14" fill="none" stroke="${N.magenta}" stroke-width="1.4"/>` +
  `<text x="22" y="244" font-family="${MONO}" font-size="9" letter-spacing="1.5" fill="${N.cyan}">KX-07</text>`

export function mechaSvg(battle: Battle, width: number, now: number): string {
  const W = 300
  const H = 270
  const boss = battle.boss
  const last = battle.log[battle.log.length - 1]
  const isFresh = last !== undefined && now - last.at < 2500
  const isHit = isFresh && (last.kind === 'hit' || last.kind === 'win')
  const status = battle.status
  const head =
    !boss || status === 'idle'
      ? { code: 'NO CONTACT', zh: '雷达静默', fg: N.dim }
      : status === 'won'
        ? { code: 'TARGET DOWN', zh: '击坠', fg: N.cyan }
        : status === 'fled'
          ? { code: 'DISENGAGED', zh: '脱离战斗', fg: N.dim }
          : { code: 'ENEMY CONTACT', zh: '敌机接近', fg: N.magenta }

  let s =
    `<defs><pattern id="hex" width="18" height="31" patternUnits="userSpaceOnUse"><path d="M9 0L18 5V15L9 20L0 15V5Z M9 20V31" fill="none" stroke="#120E20" stroke-width="1"/></pattern></defs>` +
    `<rect width="${W}" height="${H}" fill="${N.bg}"/><rect width="${W}" height="${H}" fill="url(#hex)"/>` +
    `<polygon points="${plate(10, 10, W - 20, 34, 8)}" fill="${N.plate}" stroke="${head.fg}" stroke-width="1.3"/>` +
    `<rect x="10" y="18" width="4" height="26" fill="${head.fg}"/>` +
    `<text x="22" y="33" font-family="${HEAD}" font-size="17" font-weight="700" letter-spacing="1.5" fill="${head.fg}">${head.code} <tspan font-size="12" font-weight="500" fill="${N.text}">${head.zh}</tspan></text>`

  if (boss) {
    const lit = boss.maxHp > 0 ? Math.round((boss.hp / boss.maxHp) * 20) : 0
    s +=
      `<text x="${W - 18}" y="33" text-anchor="end" font-family="${MONO}" font-size="10" fill="${N.dim}">${TIER_ZH[boss.tier]} · R${battle.rounds}</text>` +
      `<text x="14" y="62" font-family="${MONO}" font-size="9.5" letter-spacing="1.5" fill="${N.dim}">TARGET HP</text>` +
      `<text x="${W - 14}" y="62" text-anchor="end" font-family="${MONO}" font-size="10" fill="${N.text}">${boss.hp}/${boss.maxHp}</text>` +
      cellBar(14, 67, W - 28, 6, 20, lit, status === 'won' ? N.off : N.magenta)

    // The boss, recoloured for the cockpit.
    const P = 8
    const grid = spriteOf(boss.seed, boss.tier)
    const ox = 172
    const oy = 92
    const isDown = status === 'won' || status === 'fled'
    let px = ''
    grid.forEach((row, y) =>
      row.forEach((v, x) => {
        if (!v) return
        const fill = v === 1 ? N.magenta : v === 2 ? '#8E1F55' : v === 3 ? N.yellow : N.bg
        px += `<rect x="${ox + x * P}" y="${oy + y * P}" width="${P}" height="${P}" fill="${fill}"/>`
      }),
    )
    const bcx = ox + (13 * P) / 2
    const bcy = oy + (12 * P) / 2
    const shake = isHit
      ? `<animateTransform attributeName="transform" type="translate" values="0 0;-6 0;5 0;-3 0;0 0" dur="0.45s" repeatCount="1"/>`
      : `<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="2.6s" repeatCount="indefinite"/>`
    s += `<g opacity="${isDown ? 0.3 : 1}" shape-rendering="crispEdges">${shake}${px}</g>`
    // Lock-on reticle.
    const r = 62
    if (!isDown) {
      s +=
        `<g stroke="${N.cyan}" stroke-width="1.6" fill="none"><animateTransform attributeName="transform" type="rotate" from="0 ${bcx} ${bcy}" to="90 ${bcx} ${bcy}" dur="4s" repeatCount="indefinite"/>` +
        `<path d="M${bcx - r} ${bcy - r + 16}V${bcy - r}H${bcx - r + 16}M${bcx + r - 16} ${bcy - r}H${bcx + r}V${bcy - r + 16}M${bcx + r} ${bcy + r - 16}V${bcy + r}H${bcx + r - 16}M${bcx - r + 16} ${bcy + r}H${bcx - r}V${bcy + r - 16}"/></g>` +
        `<path d="M${bcx - 8} ${bcy}H${bcx + 8}M${bcx} ${bcy - 8}V${bcy + 8}" stroke="${N.cyan}" stroke-width="1"/>` +
        `<text x="${bcx}" y="${bcy + r + 14}" text-anchor="middle" font-family="${MONO}" font-size="9" letter-spacing="1.5" fill="${N.cyan}">LOCK · ${boss.kind}</text>`
    } else if (status === 'won') {
      s +=
        `<path d="M${bcx - 40} ${bcy - 40}L${bcx + 40} ${bcy + 40}M${bcx + 40} ${bcy - 40}L${bcx - 40} ${bcy + 40}" stroke="${N.cyan}" stroke-width="3"/>` +
        `<text x="${bcx}" y="${bcy + 64}" text-anchor="middle" font-family="${HEAD}" font-size="16" font-weight="700" letter-spacing="2" fill="${N.cyan}">DOWN · 击坠</text>`
    }
    // The shot: a beam from KX-07's cannon to the boss, played once on a fresh hit.
    if (isHit) {
      s +=
        `<line x1="178" y1="171" x2="${bcx}" y2="${bcy}" stroke="${N.cyan}" stroke-width="4" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="1;1;0" dur="0.7s" repeatCount="1"/></line>` +
        `<circle cx="${bcx}" cy="${bcy}" r="6" fill="none" stroke="${N.yellow}" stroke-width="2" opacity="0"><animate attributeName="r" values="6;34" dur="0.6s" repeatCount="1"/><animate attributeName="opacity" values="1;0" dur="0.6s" repeatCount="1"/></circle>`
    }
  } else {
    s += `<text x="${W - 70}" y="150" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${N.dim}">ALL CLEAR</text>`
  }
  s += KX07
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${Math.min(width, 360)}">${s}</svg>`
}
