// Drawing the garden: health from the context fill, a plant per turn. No `$` here.
import type { Garden, Plant, PlantKind } from '../types'

export type Health = 'lush' | 'dry' | 'wilted'

export function healthOf(pct: number): Health {
  return pct >= 80 ? 'wilted' : pct >= 50 ? 'dry' : 'lush'
}

export const HEALTH_ZH: Record<Health, string> = { lush: '茂盛', dry: '有点干', wilted: '快枯了' }

export const KIND_ZH: Record<PlantKind, string> = {
  grass: '草（读）',
  flower: '花（改）',
  tree: '树（执行）',
  mushroom: '蘑菇（子代理）',
  vine: '藤（网络）',
  sprout: '嫩芽（只聊天）',
}

const GLYPH: Record<Health, Record<PlantKind, string>> = {
  lush: { grass: '🌿', flower: '🌸', tree: '🌳', mushroom: '🍄', vine: '🌱', sprout: '🌱' },
  dry: { grass: '🌾', flower: '🌼', tree: '🌲', mushroom: '🍄', vine: '🌾', sprout: '🌱' },
  wilted: { grass: '🍂', flower: '🥀', tree: '🪵', mushroom: '🍂', vine: '🍂', sprout: '🍂' },
}

export const glyphOf = (kind: PlantKind, health: Health) => GLYPH[health][kind]

export function barText(pct: number, cells = 20): string {
  const lit = Math.max(0, Math.min(cells, Math.round((pct / 100) * cells)))
  return '█'.repeat(lit) + '░'.repeat(cells - lit)
}

const PAL: Record<Health, { sky0: string; sky1: string; soil: string; grass: string; leaf: string; dark: string; petal: string; bark: string; cap: string; sun: string }> = {
  lush: { sky0: '#BFE8FF', sky1: '#EAF8FF', soil: '#6B4A2B', grass: '#4CAF50', leaf: '#3E9B47', dark: '#2E7D32', petal: '#FF7EB6', bark: '#7A5230', cap: '#E5484D', sun: '#FFD54A' },
  dry: { sky0: '#F4E3B5', sky1: '#FBF3DC', soil: '#7A5A34', grass: '#A3A84A', leaf: '#8E9440', dark: '#6F7531', petal: '#F2B14A', bark: '#7A5A3A', cap: '#C9763D', sun: '#FFB13D' },
  wilted: { sky0: '#B9B2A6', sky1: '#D9D3C8', soil: '#5A4532', grass: '#8C6E45', leaf: '#7D6140', dark: '#5E4730', petal: '#8E5A4E', bark: '#5E4632', cap: '#8B5A44', sun: '#E8D9B8' },
}

/** One plant at its base point (x, y), drooping as health falls. */
function plantSvg(p: Plant, x: number, y: number, h: Health): string {
  const c = PAL[h]
  const lean = h === 'wilted' ? 14 : h === 'dry' ? 5 : 0
  const s = 0.85 + ((p.seed % 30) / 100)
  const g = (inner: string) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})">${inner}</g>`
  switch (p.kind) {
    case 'grass':
      return g(
        `<path d="M-6 0 Q-7 -12 ${-9 + lean} -20 M0 0 Q0 -14 ${2 + lean} -24 M6 0 Q7 -11 ${10 + lean} -18" stroke="${c.grass}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
      )
    case 'flower':
      return g(
        `<path d="M0 0 Q${lean / 2} -12 ${lean} -24" stroke="${c.leaf}" stroke-width="2.2" fill="none"/>` +
          `<ellipse cx="${-5 + lean / 3}" cy="-10" rx="5" ry="2.4" fill="${c.leaf}" transform="rotate(-25 ${-5 + lean / 3} -10)"/>` +
          [0, 72, 144, 216, 288]
            .map(a => `<ellipse cx="${lean}" cy="-30" rx="3.4" ry="6" fill="${c.petal}" transform="rotate(${a + lean * 2} ${lean} -24)"/>`)
            .join('') +
          `<circle cx="${lean}" cy="-24" r="3" fill="${c.sun}"/>`,
      )
    case 'tree':
      return g(
        `<path d="M-3 0 L-2 -22 L2 -22 L3 0Z" fill="${c.bark}"/>` +
          (h === 'wilted'
            ? `<path d="M0 -20 L-10 -32 M0 -22 L9 -34 M0 -26 L0 -38" stroke="${c.bark}" stroke-width="2" fill="none"/>`
            : `<circle cx="0" cy="-32" r="13" fill="${c.dark}"/><circle cx="-8" cy="-26" r="9" fill="${c.leaf}"/><circle cx="8" cy="-27" r="9" fill="${c.leaf}"/>`),
      )
    case 'mushroom':
      return g(
        `<rect x="-2.5" y="-11" width="5" height="11" rx="2" fill="#F3E9D8"/>` +
          `<path d="M-10 -10 Q0 ${-24 + lean / 2} 10 -10Z" fill="${c.cap}"/>` +
          `<circle cx="-4" cy="-14" r="1.6" fill="#FFF6E8"/><circle cx="3" cy="-16" r="1.4" fill="#FFF6E8"/>`,
      )
    case 'vine':
      return g(
        `<path d="M0 0 C-8 -8 8 -14 0 -22 C-8 -30 6 -34 ${2 + lean} -40" stroke="${c.leaf}" stroke-width="2" fill="none"/>` +
          `<ellipse cx="-5" cy="-8" rx="4" ry="2.2" fill="${c.grass}"/><ellipse cx="5" cy="-17" rx="4" ry="2.2" fill="${c.grass}"/><ellipse cx="-4" cy="-29" rx="4" ry="2.2" fill="${c.grass}"/>`,
      )
    default:
      return g(
        `<path d="M0 0 V-9" stroke="${c.grass}" stroke-width="2"/><ellipse cx="-4" cy="-10" rx="4" ry="2.2" fill="${c.grass}"/><ellipse cx="4" cy="-11" rx="4" ry="2.2" fill="${c.grass}"/>`,
      )
  }
}

const PER_ROW = 10

export function gardenSvg(garden: Garden, width: number): string {
  const h = healthOf(garden.pct)
  const c = PAL[h]
  const W = 320
  const rows = Math.max(2, Math.ceil(garden.plants.length / PER_ROW))
  const groundTop = 96
  const rowH = 34
  const H = groundTop + rows * rowH + 46
  let s =
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.sky0}"/><stop offset="1" stop-color="${c.sky1}"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" rx="12" fill="url(#sky)"/>` +
    `<circle cx="270" cy="38" r="${h === 'wilted' ? 14 : 18}" fill="${c.sun}" opacity="${h === 'wilted' ? 0.6 : 1}"/>`
  if (h === 'wilted') {
    s += `<g fill="#9E978B"><ellipse cx="90" cy="34" rx="34" ry="12"/><ellipse cx="120" cy="28" rx="26" ry="12"/><ellipse cx="200" cy="44" rx="30" ry="10"/></g>`
  } else if (h === 'dry') {
    s += `<g stroke="${c.sun}" stroke-width="2" opacity=".7">${[0, 45, 90, 135, 180, 225, 270, 315]
      .map(a => {
        const t = (a * Math.PI) / 180
        return `<line x1="${(270 + Math.cos(t) * 24).toFixed(1)}" y1="${(38 + Math.sin(t) * 24).toFixed(1)}" x2="${(270 + Math.cos(t) * 31).toFixed(1)}" y2="${(38 + Math.sin(t) * 31).toFixed(1)}"/>`
      })
      .join('')}</g>`
  }
  // Soil beds, one per row.
  s += `<rect x="0" y="${groundTop - 6}" width="${W}" height="${H - groundTop - 40}" fill="${c.soil}"/>`
  for (let r = 0; r < rows; r += 1) {
    const y = groundTop + r * rowH + rowH - 6
    s += `<rect x="10" y="${y - 2}" width="${W - 20}" height="6" rx="3" fill="${h === 'wilted' ? '#4A382A' : '#5A3D22'}"/>`
    if (h === 'wilted') s += `<path d="M30 ${y + 3} l8 -3 l6 4 l9 -2 M180 ${y + 3} l7 -2 l8 3" stroke="#3B2C20" stroke-width="1" fill="none"/>`
  }
  garden.plants.forEach((p, i) => {
    const r = Math.floor(i / PER_ROW)
    const col = i % PER_ROW
    const x = 24 + col * ((W - 48) / (PER_ROW - 1)) + ((p.seed % 7) - 3)
    const y = groundTop + r * rowH + rowH - 6
    s += plantSvg(p, x, y, h)
  })
  if (garden.plants.length === 0) {
    s += `<text x="${W / 2}" y="${groundTop + 30}" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="12" fill="#F3E9D8">刚翻过土，等第一轮对话发芽</text>`
  }
  // Context gauge.
  const gy = H - 30
  const fill = h === 'wilted' ? '#C0392B' : h === 'dry' ? '#E0A030' : '#3FA34D'
  s +=
    `<rect x="14" y="${gy}" width="${W - 28}" height="10" rx="5" fill="#00000033"/>` +
    `<rect x="14" y="${gy}" width="${(((W - 28) * Math.min(100, garden.pct)) / 100).toFixed(1)}" height="10" rx="5" fill="${fill}"/>` +
    `<line x1="${14 + (W - 28) * 0.8}" y1="${gy - 3}" x2="${14 + (W - 28) * 0.8}" y2="${gy + 13}" stroke="#C0392B" stroke-width="1.5" stroke-dasharray="2 2"/>` +
    `<text x="14" y="${gy + 24}" font-family="ui-monospace,monospace" font-size="10" fill="#3B2C20">CONTEXT ${garden.pct}%</text>` +
    `<text x="${W - 14}" y="${gy + 24}" text-anchor="end" font-family="ui-monospace,monospace" font-size="10" fill="#3B2C20">${garden.plants.length} 株 · ${HEALTH_ZH[h]}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${Math.min(width, 400)}">${s}</svg>`
}
