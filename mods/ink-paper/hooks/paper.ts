// INK & PAPER: the calendar (solar terms, the double hours), the palette, the
// ink-wash scene and the look. No `$` here.
import type { ThemeMessageRule, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'

// ── the calendar ────────────────────────────────────────────────────────────

/**
 * The 24 solar terms by their usual Gregorian date. The real dates move by a
 * day either way from year to year; this is close enough for a status line.
 */
export const SOLAR_TERMS: ReadonlyArray<readonly [month: number, day: number, name: string]> = [
  [1, 6, '小寒'],
  [1, 20, '大寒'],
  [2, 4, '立春'],
  [2, 19, '雨水'],
  [3, 5, '惊蛰'],
  [3, 20, '春分'],
  [4, 5, '清明'],
  [4, 20, '谷雨'],
  [5, 5, '立夏'],
  [5, 21, '小满'],
  [6, 6, '芒种'],
  [6, 21, '夏至'],
  [7, 7, '小暑'],
  [7, 23, '大暑'],
  [8, 7, '立秋'],
  [8, 23, '处暑'],
  [9, 7, '白露'],
  [9, 23, '秋分'],
  [10, 8, '寒露'],
  [10, 23, '霜降'],
  [11, 7, '立冬'],
  [11, 22, '小雪'],
  [12, 7, '大雪'],
  [12, 21, '冬至'],
]

/** The solar term in force on `date`: the latest one on or before it. */
export function solarTermOf(date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  let current = SOLAR_TERMS[SOLAR_TERMS.length - 1]![2] // before 小寒 it is still 冬至
  for (const [tm, td, name] of SOLAR_TERMS) {
    if (m > tm || (m === tm && d >= td)) current = name
  }
  return current
}

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

/** The double hour (时辰): 子 is 23:00 to 01:00, 丑 01:00 to 03:00, and so on. */
export function shichenOf(date: Date): string {
  return `${BRANCHES[Math.floor(((date.getHours() + 1) % 24) / 2)]}时`
}

export const statusOf = (date: Date) => `🖌 ${solarTermOf(date)} · ${shichenOf(date)}`

// ── the palette ─────────────────────────────────────────────────────────────

type Hex = `#${string}`

/** The seal's vermilion: at least 3:1 against both the dark ink and the pale text. */
export const SEAL: Hex = '#D2553F'

const PAPER = {
  light: {
    bgUser: '#F6EFE0',
    bgReply: '#FBF8F1',
    text: '#22201C',
  },
  dark: {
    bgUser: '#231E17',
    bgReply: '#1C1813',
    text: '#EDE4D3',
  },
} as const

export function colorsOf() {
  const made = makeColors({
    label: 'INK & PAPER · 水墨书斋',
    roles: { accent: '#2E5E7E', danger: '#B03A2E', success: '#4F7A45', warning: '#A87420', pro: '#6A4C8C' },
    light: {
      gray: {
        anchors: {
          'surface-0': '#EDE4D1',
          'surface-1': '#F3ECDD',
          'surface-2': '#F9F5EC',
          'text-primary': '#22201C',
          'text-secondary': '#4A443A',
          'text-muted': '#665D4F',
        },
      },
    },
    dark: {
      gray: {
        anchors: {
          'surface-0': '#16130F',
          'surface-1': '#1D1914',
          'surface-2': '#241F19',
          'surface-3': '#2B251E',
          'text-primary': '#EDE4D3',
          'text-secondary': '#CDBFA8',
          'text-muted': '#A89A82',
        },
      },
    },
  })
  const inputs = made.theme.inputs as Record<'light' | 'dark', Record<string, string> | undefined>
  for (const mode of ['light', 'dark'] as const) {
    const p = PAPER[mode]
    inputs[mode] = {
      ...(inputs[mode] ?? {}),
      'bg-user-message': p.bgUser,
      'text-user-message': p.text,
      'bg-assistant-message': p.bgReply,
      'text-assistant-message': p.text,
    }
  }
  return made
}

// ── the scene ───────────────────────────────────────────────────────────────

export const SCENE_ID = 'ink-wash'

/**
 * Layered mountains in washes of ink, two bands of mist drifting very slowly,
 * a vermilion sun (a moon by night) and a small boat. Paper by day, lamp-lit
 * ink by night through the scene's own media query. Under reduced motion the
 * mist rests where the markup puts it.
 */
export const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.paper { fill: #EFE7D6; }
.far { fill: #9AA3A6; opacity: 0.22; }
.mid { fill: #5F6B70; opacity: 0.2; }
.near { fill: #2B3134; opacity: 0.2; }
.mist { fill: #F6F1E6; opacity: 0.55; }
.sun { fill: #C4553F; opacity: 0.5; }
.boat { fill: none; stroke: #2B3134; stroke-width: 3; stroke-linecap: round; opacity: 0.35; }
.drift-a { animation: drift 90s ease-in-out infinite alternate; }
.drift-b { animation: drift 120s ease-in-out infinite alternate-reverse; }
@keyframes drift { from { transform: translateX(-60px); } to { transform: translateX(60px); } }
@media (prefers-color-scheme: dark) {
.paper { fill: #15120E; }
.far { fill: #6E7A80; opacity: 0.2; }
.mid { fill: #8A969B; opacity: 0.14; }
.near { fill: #B7C0C3; opacity: 0.1; }
.mist { fill: #2A251E; opacity: 0.6; }
.sun { fill: #E9DFC8; opacity: 0.35; }
.boat { stroke: #CDBFA8; opacity: 0.3; }
}
</style>
<rect class="paper" width="1600" height="1000"/>
<circle class="sun" cx="1230" cy="230" r="56"/>
<path class="far" d="M0 560 C120 470 210 430 300 470 C380 505 430 380 520 360 C610 340 660 450 760 440 C860 430 930 300 1040 310 C1150 320 1200 430 1300 420 C1400 410 1480 360 1600 400 V1000 H0 Z"/>
<g class="drift-a"><rect class="mist" x="-120" y="520" width="1840" height="70" rx="35"/></g>
<path class="mid" d="M0 680 C90 600 170 560 260 600 C340 635 380 540 470 520 C560 500 600 600 690 610 C800 620 860 520 960 530 C1060 540 1110 630 1210 620 C1320 610 1400 560 1600 600 V1000 H0 Z"/>
<g class="drift-b"><rect class="mist" x="-120" y="700" width="1840" height="80" rx="40"/></g>
<path class="near" d="M0 820 C140 760 240 750 340 790 C430 825 520 760 640 770 C760 780 820 850 940 840 C1060 830 1140 770 1260 780 C1380 790 1470 840 1600 820 V1000 H0 Z"/>
<path class="boat" d="M700 742 Q740 760 790 742 M745 742 V712 L765 734"/>
</svg>`

// ── the look ────────────────────────────────────────────────────────────────

/** A paper box with a vermilion seal stamped at its top-right corner. */
const sealed: ThemeMessageRule = {
  color: 'text-user-message',
  backgroundColor: 'bg-user-message',
  padding: 14,
  fill: {
    vector: {
      viewBox: 48,
      slice: 14,
      paths: [
        { d: 'M0 0H48V48H0Z', color: 'bg-user-message' },
        { d: 'M36 3H45V12H36Z', color: SEAL },
        { d: 'M33 14H38V19H33Z', color: SEAL },
      ],
    },
  },
}

/** A quiet slip of paper. */
const slip: ThemeMessageRule = {
  color: 'text-assistant-message',
  backgroundColor: 'bg-assistant-message',
  radius: 2,
  paddingX: 16,
  paddingY: 12,
  shadow: { y: 1, blur: 4, color: '#0000001A' },
}

export function lookOf(): ThemeSetArgs {
  return {
    colors: colorsOf().theme,
    backdrop: { scene: SCENE_ID, glass: { blur: 10, opacity: 0.55 } },
    style: {
      Text: { fontFamily: ['serif'], fontSize: 15, lineHeight: 25 },
      Heading: { fontFamily: ['serif'], fontWeight: 'bold', letterSpacing: 1 },
      UserMessage: sealed,
      AssistantMessage: slip,
      ToolUse: { fontFamily: ['code'], radius: 2, paddingX: 8 },
    },
  }
}

export const lookWithoutStyle = (): ThemeSetArgs => {
  const { style: _style, ...rest } = lookOf()
  return rest
}
