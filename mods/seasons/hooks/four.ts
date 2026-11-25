// SEASONS 四时: which season and time of day it is, each season's palette, and
// its scene by day and by night. No `$` here.
import type { ThemeSetArgs } from 'claude-code'

import type { Season, TimeOfDay } from '../types'
import { makeColors } from './make-colors.js'

type Hex = `#${string}`

// ── when ────────────────────────────────────────────────────────────────────

/** Northern-hemisphere meteorological seasons: spring is March to May, and so on. */
export function seasonOf(date: Date): Season {
  const m = date.getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

/** Day runs from 06:00 to 18:00. */
export function timeOf(date: Date): TimeOfDay {
  const h = date.getHours()
  return h >= 6 && h < 18 ? 'day' : 'night'
}

export const SEASON_ZH: Record<Season, string> = { spring: '春 · 樱', summer: '夏 · 萤', autumn: '秋 · 枫', winter: '冬 · 雪' }
export const TIME_ZH: Record<TimeOfDay, string> = { day: '昼', night: '夜' }

export const sceneId = (s: Season, t: TimeOfDay) => `seasons-${s}-${t}`

export function parseSceneId(id: string): { season: Season; time: TimeOfDay } | undefined {
  const m = /^seasons-(spring|summer|autumn|winter)-(day|night)$/.exec(id)
  return m ? { season: m[1] as Season, time: m[2] as TimeOfDay } : undefined
}

// ── the palettes ────────────────────────────────────────────────────────────

type Anchors = { s0: Hex; s1: Hex; s2: Hex; s3?: Hex; text: Hex; secondary: Hex; muted: Hex }

type Palette = {
  label: string
  roles: { accent: Hex; danger: Hex; success: Hex; warning: Hex; pro: Hex }
  light: Anchors
  dark: Anchors
}

export const PALETTES: Record<Season, Palette> = {
  spring: {
    label: 'SEASONS · 春 樱',
    roles: { accent: '#C2557A', danger: '#C0392B', success: '#4F8A4B', warning: '#B07A1E', pro: '#7A5AA6' },
    light: { s0: '#F7EEF0', s1: '#FAF3F5', s2: '#FDF8F9', text: '#2B2226', secondary: '#54464C', muted: '#6E5F65' },
    dark: { s0: '#1C1518', s1: '#231B1F', s2: '#2A2126', s3: '#31272C', text: '#F6E9EE', secondary: '#D9C3CC', muted: '#B49FA8' },
  },
  summer: {
    label: 'SEASONS · 夏 萤',
    roles: { accent: '#2E8B6A', danger: '#C0392B', success: '#3F8F3A', warning: '#B48A16', pro: '#5B6CC4' },
    light: { s0: '#EDF4EE', s1: '#F3F8F4', s2: '#F9FCF9', text: '#1C2820', secondary: '#425046', muted: '#5C6B60' },
    dark: { s0: '#0D1611', s1: '#121E17', s2: '#17261D', s3: '#1C2D23', text: '#E6F2E9', secondary: '#BFD6C6', muted: '#98B3A1' },
  },
  autumn: {
    label: 'SEASONS · 秋 枫',
    roles: { accent: '#C4561D', danger: '#B8322A', success: '#5E7F2E', warning: '#B5831B', pro: '#8A4F7D' },
    light: { s0: '#F5EDE3', s1: '#F9F3EB', s2: '#FCF9F4', text: '#2B2118', secondary: '#55473A', muted: '#6F6050' },
    dark: { s0: '#1B140E', s1: '#231A12', s2: '#2B2017', s3: '#33271C', text: '#F3E6D6', secondary: '#D6C2AA', muted: '#B39E84' },
  },
  winter: {
    label: 'SEASONS · 冬 雪',
    roles: { accent: '#3D6E9E', danger: '#B8392E', success: '#3E7F5A', warning: '#A9781C', pro: '#6B5CA8' },
    light: { s0: '#ECF0F5', s1: '#F2F5F9', s2: '#F8FAFC', text: '#1D2430', secondary: '#434C5A', muted: '#5D6676' },
    dark: { s0: '#0E131A', s1: '#131A23', s2: '#18212C', s3: '#1D2835', text: '#E6EDF5', secondary: '#C0CCDA', muted: '#98A6B6' },
  },
}

const anchorsOf = (a: Anchors) => ({
  'surface-0': a.s0,
  'surface-1': a.s1,
  'surface-2': a.s2,
  ...(a.s3 ? { 'surface-3': a.s3 } : {}),
  'text-primary': a.text,
  'text-secondary': a.secondary,
  'text-muted': a.muted,
})

export function colorsOf(season: Season) {
  const p = PALETTES[season]
  return makeColors({
    label: p.label,
    roles: p.roles,
    light: { gray: { anchors: anchorsOf(p.light) } },
    dark: { gray: { anchors: anchorsOf(p.dark) } },
  })
}

// ── the scenes ──────────────────────────────────────────────────────────────

type Sky = { top: Hex; bottom: Hex; far: Hex; near: Hex; orb: Hex; orbOpacity: number }

const SKIES: Record<Season, Record<TimeOfDay, Sky>> = {
  spring: {
    day: { top: '#F6E3EA', bottom: '#FBF4F1', far: '#D9B9C6', near: '#B98FA2', orb: '#FFF4E8', orbOpacity: 0.9 },
    night: { top: '#1A1424', bottom: '#2E2233', far: '#3A2B3E', near: '#2A1F2E', orb: '#F3E6EE', orbOpacity: 0.75 },
  },
  summer: {
    day: { top: '#D7EDF2', bottom: '#F1F8EE', far: '#A8CBB0', near: '#7FAE88', orb: '#FFF6D6', orbOpacity: 0.95 },
    night: { top: '#07120F', bottom: '#12241C', far: '#183026', near: '#0E1F18', orb: '#E8F2E4', orbOpacity: 0.6 },
  },
  autumn: {
    day: { top: '#F3DFC4', bottom: '#FAF0E2', far: '#D9A779', near: '#B9774A', orb: '#FFE9C7', orbOpacity: 0.9 },
    night: { top: '#160F0B', bottom: '#2A1C13', far: '#3A2618', near: '#26180F', orb: '#F4E2C6', orbOpacity: 0.7 },
  },
  winter: {
    day: { top: '#DCE6F0', bottom: '#F3F6FA', far: '#C2CFDD', near: '#E8EEF5', orb: '#FFFFFF', orbOpacity: 0.85 },
    night: { top: '#0A1019', bottom: '#18222F', far: '#253244', near: '#3A4A5E', orb: '#E3ECF7', orbOpacity: 0.7 },
  },
}

function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Kind = 'petal' | 'firefly' | 'seed' | 'leaf' | 'snow'

function kindOf(season: Season, time: TimeOfDay): Kind {
  if (season === 'spring') return 'petal'
  if (season === 'summer') return time === 'night' ? 'firefly' : 'seed'
  if (season === 'autumn') return 'leaf'
  return 'snow'
}

const LEAF_COLORS = ['#C8462B', '#D9772E', '#C99A2E', '#A8342A']

function shape(kind: Kind, i: number, time: TimeOfDay): string {
  switch (kind) {
    case 'petal':
      return `<path d="M0 -9 C6 -6 7 3 0 9 C-7 3 -6 -6 0 -9 Z" fill="${time === 'day' ? '#F2A7BC' : '#D98AA2'}" fill-opacity="0.85"/>`
    case 'leaf':
      return `<path d="M0 -12 C8 -6 9 4 0 12 C-9 4 -8 -6 0 -12 Z M0 -12 V12" fill="${LEAF_COLORS[i % LEAF_COLORS.length]}" fill-opacity="${time === 'day' ? 0.85 : 0.6}" stroke="#00000022" stroke-width="1"/>`
    case 'snow':
      return `<circle r="${3 + (i % 3)}" fill="${time === 'day' ? '#FFFFFF' : '#DCE7F5'}" fill-opacity="${time === 'day' ? 0.95 : 0.8}"/>`
    case 'seed':
      return `<g stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="1.2"><path d="M0 0 L0 -8 M0 0 L6 -6 M0 0 L-6 -6 M0 0 L8 0 M0 0 L-8 0"/></g><circle r="1.6" fill="#E9E2C8"/>`
    case 'firefly':
      return `<circle r="10" fill="#D9F27A" fill-opacity="0.18"/><circle r="3" fill="#E8FF8C"/>`
  }
}

/**
 * A sky, a sun or moon, two hills, and a dozen slow particles of the season.
 * Every particle rests where the markup puts it, so the scene is finished
 * under reduced motion; moving, each one takes 18 to 34 seconds to cross.
 */
export function sceneSvg(season: Season, time: TimeOfDay): string {
  const sky = SKIES[season][time]
  const kind = kindOf(season, time)
  const r = rng(season.length * 97 + (time === 'day' ? 1 : 2) * 13)
  const count = kind === 'firefly' ? 10 : 12
  const css: string[] = []
  const parts: string[] = []
  for (let i = 0; i < count; i += 1) {
    const x = Math.round(80 + r() * 1440)
    const y = Math.round(kind === 'firefly' ? 520 + r() * 380 : 60 + r() * 820)
    const dur = Math.round(18 + r() * 16)
    const delay = -Math.round(r() * dur)
    const spin = Math.round(120 + r() * 240) * (r() < 0.5 ? -1 : 1)
    const scale = (1.1 + r() * 0.8).toFixed(2)
    let frames: string
    if (kind === 'firefly') {
      const dx = Math.round(30 + r() * 50)
      const dy = Math.round(20 + r() * 40)
      frames = `0% { transform: translate(0px, 0px); } 33% { transform: translate(${dx}px, ${-dy}px); } 66% { transform: translate(${-dx / 2}px, ${-dy * 1.5}px); } 100% { transform: translate(0px, 0px); }`
      css.push(`.g${i} { animation: glow 6s ease-in-out ${delay % 6}s infinite alternate; }`)
    } else if (kind === 'seed') {
      frames = `from { transform: translate(${-(x + 120)}px, 0px); } to { transform: translate(${1720 - x}px, -90px); }`
    } else {
      const drift = Math.round(60 + r() * 100) * (r() < 0.5 ? -1 : 1)
      frames = `from { transform: translate(0px, ${-(y + 60)}px) rotate(0deg); } to { transform: translate(${drift}px, ${1060 - y}px) rotate(${spin}deg); }`
    }
    css.push(`@keyframes m${i} { ${frames} }`)
    css.push(
      `.m${i} { animation: m${i} ${kind === 'firefly' ? dur / 2 : dur}s ${kind === 'firefly' ? 'ease-in-out' : 'linear'} ${delay}s infinite; transform-box: fill-box; transform-origin: center; }`,
    )
    parts.push(`<g transform="translate(${x} ${y}) scale(${scale})"><g class="m${i}"><g class="g${i}">${shape(kind, i, time)}</g></g></g>`)
  }
  if (kind === 'firefly') css.push('@keyframes glow { from { opacity: 0.35; } to { opacity: 0.95; } }')

  const stars =
    time === 'night'
      ? Array.from({ length: 22 }, () => {
          const sx = Math.round(r() * 1600)
          const sy = Math.round(r() * 420)
          return `<circle cx="${sx}" cy="${sy}" r="${(0.8 + r() * 1.2).toFixed(1)}" fill="#FFFFFF" fill-opacity="${(0.3 + r() * 0.4).toFixed(2)}"/>`
        }).join('')
      : ''
  const orb =
    time === 'day'
      ? `<circle cx="1260" cy="200" r="90" fill="${sky.orb}" fill-opacity="${sky.orbOpacity}"/>`
      : `<circle cx="1260" cy="190" r="54" fill="${sky.orb}" fill-opacity="${sky.orbOpacity}"/><circle cx="1284" cy="176" r="50" fill="${sky.top}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
${css.join('\n')}
</style>
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.top}"/><stop offset="1" stop-color="${sky.bottom}"/></linearGradient></defs>
<rect width="1600" height="1000" fill="url(#sky)"/>
${stars}${orb}
<path d="M0 700 C200 620 360 600 520 650 C700 705 820 600 1000 610 C1180 620 1300 690 1600 650 V1000 H0 Z" fill="${sky.far}"/>
<path d="M0 820 C220 770 420 760 620 800 C820 840 1000 780 1200 790 C1380 800 1500 830 1600 820 V1000 H0 Z" fill="${sky.near}"/>
${parts.join('\n')}
</svg>`
}

// ── the look ────────────────────────────────────────────────────────────────

export function lookOf(season: Season, time: TimeOfDay): ThemeSetArgs {
  return {
    colors: colorsOf(season).theme,
    backdrop: { scene: sceneId(season, time), glass: { blur: 12, opacity: 0.6 } },
  }
}
