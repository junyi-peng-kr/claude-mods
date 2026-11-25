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
