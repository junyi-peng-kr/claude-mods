// TERMINAL 1983: palettes, the CRT scene and the look, for green and amber phosphor.
import type { ThemeMessageRule, ThemeSetArgs } from 'claude-code'

type Hex = `#${string}`

import type { Tint } from '../types'
import { makeColors } from './make-colors.js'

export type Phosphor = {
  label: string
  bg: Hex
  s1: Hex
  s2: Hex
  s3: Hex
  text: Hex
  secondary: Hex
  muted: Hex
  glow: Hex
  roles: { accent: Hex; danger: Hex; success: Hex; warning: Hex; pro: Hex }
}

export const PHOSPHOR: Record<Tint, Phosphor> = {
  green: {
    label: 'TERMINAL 1983 · P1 green',
    bg: '#020A04',
    s1: '#05120A',
    s2: '#08180D',
    s3: '#0B1F11',
    text: '#A8FFBF',
    secondary: '#6EEB92',
    muted: '#45C46B',
    glow: '#33FF66',
    roles: { accent: '#33FF66', danger: '#FF6A5C', success: '#8CFFA6', warning: '#F2E25C', pro: '#5CE6D9' },
  },
  amber: {
    label: 'TERMINAL 1983 · P3 amber',
    bg: '#0B0700',
    s1: '#130C02',
    s2: '#1A1104',
    s3: '#211607',
    text: '#FFD98A',
    secondary: '#F5BC55',
    muted: '#CF9434',
    glow: '#FFB000',
    roles: { accent: '#FFB000', danger: '#FF6B4A', success: '#C9E36B', warning: '#FFD24A', pro: '#F2A3E8' },
  },
}

export function colorsOf(tint: Tint) {
  const p = PHOSPHOR[tint]
  return makeColors({
    label: p.label,
    only: 'dark',
    roles: p.roles,
    dark: {
      gray: {
        anchors: {
          'surface-0': p.bg,
          'surface-1': p.s1,
          'surface-2': p.s2,
          'surface-3': p.s3,
          'text-primary': p.text,
          'text-secondary': p.secondary,
          'text-muted': p.muted,
        },
      },
    },
  })
}

export const sceneId = (tint: Tint) => `crt-${tint}`

/**
 * The tube: a dark glass with a faint glow at its centre, fine scanlines, a
 * vignette, and one soft bright band rolling down every 14 seconds.
 * Still under reduced motion: the band rests above the top.
 */
export function sceneSvg(tint: Tint): string {
  const p = PHOSPHOR[tint]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.roll { animation: roll 14s linear infinite; }
@keyframes roll { from { transform: translateY(-260px); } to { transform: translateY(1260px); } }
.hum { animation: hum 7s ease-in-out infinite; }
@keyframes hum { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.7; } }
</style>
<defs>
<radialGradient id="glass" cx="50%" cy="46%" r="75%">
<stop offset="0" stop-color="${p.s2}"/>
<stop offset="0.55" stop-color="${p.bg}"/>
<stop offset="1" stop-color="#000000"/>
</radialGradient>
<radialGradient id="bloom" cx="50%" cy="45%" r="45%">
<stop offset="0" stop-color="${p.glow}" stop-opacity="0.14"/>
<stop offset="1" stop-color="${p.glow}" stop-opacity="0"/>
</radialGradient>
<pattern id="lines" width="4" height="4" patternUnits="userSpaceOnUse">
<rect width="4" height="2" fill="#000000" fill-opacity="0.38"/>
</pattern>
<linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${p.glow}" stop-opacity="0"/>
<stop offset="0.5" stop-color="${p.glow}" stop-opacity="0.07"/>
<stop offset="1" stop-color="${p.glow}" stop-opacity="0"/>
</linearGradient>
<radialGradient id="vignette" cx="50%" cy="50%" r="72%">
<stop offset="0.62" stop-color="#000000" stop-opacity="0"/>
<stop offset="1" stop-color="#000000" stop-opacity="0.85"/>
</radialGradient>
</defs>
<rect width="1600" height="1000" fill="url(#glass)"/>
<rect class="hum" width="1600" height="1000" fill="url(#bloom)"/>
<rect class="roll" y="0" width="1600" height="240" fill="url(#band)"/>
<rect width="1600" height="1000" fill="url(#lines)"/>
<rect width="1600" height="1000" fill="url(#vignette)"/>
<rect x="18" y="18" width="1564" height="964" rx="48" fill="none" stroke="#000000" stroke-opacity="0.6" stroke-width="36"/>
</svg>`
}

export function lookOf(tint: Tint, withSound: boolean): ThemeSetArgs {
  const p = PHOSPHOR[tint]
  const { theme } = colorsOf(tint)
  const user: ThemeMessageRule = {
    color: p.text,
    backgroundColor: p.s1,
    borderColor: p.muted,
    borderWidth: 1,
    radius: 0,
    padding: 12,
  }
  const reply: ThemeMessageRule = {
    color: p.text,
    backgroundColor: p.bg,
    radius: 0,
    paddingX: 12,
    paddingY: 8,
  }
  const look: ThemeSetArgs = {
    colors: theme,
    overrideColorScheme: 'dark',
    backdrop: { scene: sceneId(tint), glass: { blur: 2, tint: p.bg, opacity: 0.35 } },
    style: {
      Text: { fontFamily: ['mono'], fontSize: 14, lineHeight: 22, color: p.text },
      Heading: { fontFamily: ['mono'], fontWeight: 'bold', letterSpacing: 1, color: p.glow },
      UserMessage: user,
      AssistantMessage: reply,
      ToolUse: {
        color: p.secondary,
        fontFamily: ['code'],
        backgroundColor: p.s1,
        borderColor: p.s3,
        borderWidth: 1,
        radius: 0,
        paddingX: 10,
        paddingY: 4,
      },
    },
  }
  if (!withSound) return look
  return {
    ...look,
    sound: {
      // The tube's hum and the fan, kept very low.
      ambience: {
        layers: [
          { wave: 'sine', notes: [tint === 'green' ? 'A1' : 'G1'], drone: true, gain: 0.05 },
          { wave: 'brown', drone: true, gain: 0.03 },
        ],
      },
      cues: {
        send: { layers: [{ wave: 'square', notes: ['C6'], gain: 0.05, release: 0.04 }] },
        tool: { layers: [{ wave: 'square', notes: ['G5'], gain: 0.03, release: 0.03 }] },
        done: { layers: [{ wave: 'square', notes: ['E5', 'A5'], step: 0.09, gain: 0.05, release: 0.06 }] },
        error: { layers: [{ wave: 'square', notes: ['C4', 'C4'], step: 0.14, gain: 0.05, release: 0.08 }] },
      },
    },
  }
}
