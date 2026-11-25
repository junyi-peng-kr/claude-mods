// NEON PILOT: a mecha-cockpit look for Claude Code.
//  - Look: dark violet planes, cyan accent, magenta alarm; chamfered HUD plates
//    for messages; a vector hangar with KX-07 behind the conversation.
//  - Cockpit dashboard (side panel): the pilot & KX-07 art, mission alerts,
//    stage + LINK bar, telemetry and usage. No band above the prompt: while the
//    look is on, usage-band's row there is hidden too.
//  - Mission alerts: ALL GREEN, LAUNCH, MISSION CLEAR, SYSTEM CHECK (before git push).
//  - With boss-fight installed: ENEMY CONTACT and TARGET DOWN alerts, and a lock-on
//    card with the enemy's HP while a fight runs (boss-fight draws KX-07 fighting it).
//  - /neon on | off | demo | panel
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeMessageRule, ThemeSetArgs } from 'claude-code'

import type { Combat, Flash, FlashKind, Hud } from '../types'
import { IMG } from './art'
import { C, FLASH, STAGE_ZH, barText, clip, cockpitSvg, dashHeight, isEngaged, stageColor, stageOf } from './hud'
import { makeColors } from './make-colors.js'
import { SCENE } from './scene'
import { otherLooksOn } from './looks'

const EMPTY: Hud = {
  model: '—', repo: '—', branch: '—', pct: 0, isLong: false, isWorking: false,
  turns: 0, tools: 0, startedAt: 0, lastTurnMs: 0, tokens: 0, window: 0, limits: [],
}
const hudAtom = atom({ plugin: 'neon-pilot', key: 'hud' } as const, EMPTY, { shape: 'hud-2' })
const flashAtom = atom({ plugin: 'neon-pilot', key: 'flash' } as const, null, { shape: 'flash-1' })
const isOnAtom = atom({ plugin: 'neon-pilot', key: 'isOn' } as const, true)

const LONG_MS = 3 * 60 * 1000
const FLASH_MS = 6500
const STORE_ON = 'neon-pilot.isOn'
const PANE = 'neon-cockpit'
const PANE_TITLE = 'NEON PILOT · 驾驶舱'
const SCENE_ID = 'neon-hangar'
const HIDDEN_ROWS = new Set(['usage-band'])

// ── the look ────────────────────────────────────────────────────────────────
const { theme, problems } = makeColors({
  label: 'NEON PILOT',
  only: 'dark',
  roles: { accent: '#2EF2FF', danger: '#FF2E88', success: '#7CFFB2', warning: '#FFD84A', pro: '#9D8CFF' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#07060D',
        'surface-1': '#0E0B18',
        'surface-2': '#151024',
        'surface-3': '#1A1430',
        'text-primary': '#F2ECFF',
        'text-secondary': '#D6CCEA',
        'text-muted': '#B1A4CC',
      },
    },
  },
})

// A plate with its top-left and bottom-right corners cut, sliced so it frames any message.
const PLATE = 'M10 0H48V38L38 48H0V10Z'

const userPlate: ThemeMessageRule = {
  color: '#F2ECFF',
  backgroundColor: '#151024',
  padding: 14,
  fill: {
    vector: {
      viewBox: 48,
      slice: 12,
      paths: [
        { d: PLATE, color: '#151024' },
        { d: PLATE, strokeWidth: 1, color: '#3A2C55' },
        { d: 'M0 14V10L10 0H22', strokeWidth: 2, color: '#2EF2FF' },
      ],
    },
  },
}

const replyPlate: ThemeMessageRule = {
  color: '#F2ECFF',
  backgroundColor: '#0E0B18',
  padding: 14,
  fill: {
    vector: {
      viewBox: 48,
      slice: 12,
      paths: [
        { d: PLATE, color: '#0E0B18' },
        { d: PLATE, strokeWidth: 1, color: '#2A1F3D' },
        { d: 'M48 26V38L38 48H26', strokeWidth: 2, color: '#FF2E88' },
      ],
    },
  },
}

const BASE: ThemeSetArgs = {
  colors: theme,
  overrideColorScheme: 'dark',
  backdrop: { scene: SCENE_ID, glass: { blur: 14, tint: '#07060D', opacity: 0.5 } },
}

const LOOK: ThemeSetArgs = {
  ...BASE,
  style: {
    Text: { fontFamily: ['sans'], fontSize: 15, lineHeight: 23 },
    Heading: { fontFamily: ['sans'], fontWeight: 'bold', letterSpacing: 1, color: '#2EF2FF' },
    UserMessage: userPlate,
    AssistantMessage: replyPlate,
    ToolUse: {
      color: '#B1A4CC',
      fontFamily: ['code'],
      backgroundColor: '#0E0B18',
      borderColor: '#3A2C55',
      borderWidth: 1,
      radius: 0,
      paddingX: 10,
      paddingY: 4,
    },
  },
}

// ── tool-call patterns for mission alerts ───────────────────────────────────
const TEST_RE =
  /(^|[\s;&|(])((npm|pnpm|yarn|bun)\s+(run\s+)?test\b|npx\s+(jest|vitest|mocha|playwright)\b|(jest|vitest|pytest|mocha|rspec|phpunit)\b|go\s+test\b|cargo\s+(test|nextest)\b|python3?\s+-m\s+(pytest|unittest)\b|make\s+test\b|deno\s+test\b|swift\s+test\b|mvn\s+test\b|gradle\w*\s+test\b)/
const FAIL_RE = /\b[1-9]\d*\s+(failed|failing|failures?|errors?)\b|\bFAIL(ED)?\b|Tests?:\s+[1-9]\d*\s+failed/
const PUSH_RE = /(^|[\s;&|(])git\s+push\b/
const PR_RE = /(^|[\s;&|(])gh\s+pr\s+create\b/
const LINT_RE = /\b(lint|eslint|biome|ruff|golangci-lint|clippy|tsc\b|typecheck)/

/** claude-opus-5-5[1m] → opus-5.5 */
function shortModel(id: string): string {
  return id
    .replace(/\[.*?\]/g, '')
    .replace(/^claude-/, '')
    .replace(/-(\d+)-(\d+)(?=$|-)/, '-$1.$2')
    .replace(/-\d{8}$/, '')
}

function passedCount(text: string): string | undefined {
  const m =
    text.match(/(\d+)\s+(passed|passing)/i) ??
    text.match(/Tests?:\s+(\d+)\s+passed/i) ??
    text.match(/ok\s+(\d+)\s+tests?/i)
  return m?.[1]
}

const fmtDur = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Module state: a reload starts these over.
let turnStartedAt = 0
let testsPassedAt = 0
let lintRanAt = 0
let flashSeq = 0
let tick = 0
/** The last boss-fight change this copy has seen; -1 until the first read. */
let combatSeq = -1

const combatRef = { plugin: 'boss-fight', key: 'combat' } as const

async function readCombat($: EngineInterface): Promise<Combat | null> {
  try {
    return (await $.state.get(combatRef)).value ?? null
  } catch {
    return null
  }
}

/** Flashes boss-fight's contacts and kills once each. boss-fight toasts them itself. */
async function watchCombat($: EngineInterface) {
  const c = await readCombat($)
  if (!c) {
    if (combatSeq < 0) combatSeq = 0
    return
  }
  const isFirstRead = combatSeq < 0
  const isNew = c.seq > combatSeq
  combatSeq = Math.max(combatSeq, c.seq)
  if (isFirstRead || !isNew) return
  if (c.event === 'spawn') {
    await flash($, 'contact', `${c.kind}「${clip(c.name, 18)}」· HP ${c.hp}`, `BOSS-FIGHT · ${c.tier.toUpperCase()}`, false)
  } else if (c.event === 'win') {
    await flash($, 'down', `${c.kind}「${clip(c.name, 18)}」· ${c.rounds} 回合`, 'BOSS-FIGHT · CLEAR', false)
  }
}

async function git($: EngineInterface, args: string[]): Promise<string | undefined> {
  try {
    const r = await $.process.run(['git', ...args], { timeoutMs: 4000 })
    return r.exitCode === 0 ? r.stdout.trim() : undefined
  } catch {
    return undefined
  }
}

/** Reads the session's figures into the HUD; `isFull` also reads git, model and tool calls. */
async function refresh($: EngineInterface, isFull: boolean) {
  const { context, startedAt, rateLimits, cost } = await $.session.usage()
  const pct = Math.max(0, Math.min(100, Math.round(context.percent ?? 0)))
  const turns = await $.session.turns()
  const isLong = turnStartedAt > 0 && Date.now() - turnStartedAt > LONG_MS
  const usage: Partial<Hud> = {
    pct,
    turns,
    startedAt,
    isLong,
    tokens: context.tokens ?? 0,
    window: context.window,
    limits: rateLimits.map(r => ({
      kind: r.kind,
      pct: Math.round(r.percentUsed),
      ...(r.resetsAt ? { resetsAt: r.resetsAt } : {}),
    })),
    ...(cost ? { usd: cost.usd } : {}),
  }
  let extra: Partial<Hud> = {}
  if (isFull) {
    const cwd = await $.session.cwd()
    const top = await git($, ['rev-parse', '--show-toplevel'])
    const branch = top ? await git($, ['rev-parse', '--abbrev-ref', 'HEAD']) : undefined
    const messages = await $.session.messages()
    extra = {
      model: shortModel(await $.session.model()),
      repo: (top ?? cwd).split('/').filter(Boolean).pop() ?? '—',
      branch: branch ?? '—',
      tools: messages.reduce((n, m) => n + m.toolUses.length, 0),
    }
  }
  tick += 1
  await update($, hudAtom, h => {
    const next = { ...h, ...usage, ...extra }
    const isSame =
      !isFull &&
      h.pct === next.pct &&
      h.turns === next.turns &&
      h.isLong === next.isLong &&
      h.usd === next.usd &&
      JSON.stringify(h.limits) === JSON.stringify(next.limits) &&
      tick % 3 !== 0
    return isSame ? h : next
  })
}

async function flash($: EngineInterface, kind: FlashKind, sub: string, detail: string, isToast = true) {
  if (!(await read($, isOnAtom))) return
  const f = FLASH[kind]
  const id = ++flashSeq
  const next: Flash = { kind, sub, detail, id }
  await update($, flashAtom, () => next)
  if (isToast) $.ui.toast(`${f.title} · ${f.zh} — ${sub}`, { timeoutMs: FLASH_MS })
  $.clock.after(FLASH_MS, () => {
    void update($, flashAtom, cur => (cur && cur.id === id ? null : cur))
  })
}

async function applyLook($: EngineInterface): Promise<string> {
  const paintBlock = problems.find(line => line.startsWith("Desktop won't paint"))
  if (paintBlock !== undefined) $.ui.toast(`NEON PILOT: ${paintBlock}`)
  try {
    const set = await $.theme.set(LOOK)
    return set.isDrawn ? 'drawn' : set.reason
  } catch (error) {
    // A build without `style` refuses the whole set: try again without it.
    $.ui.log(`NEON PILOT: ${String(error)}`)
    const set = await $.theme.set(BASE)
    return set.isDrawn ? 'drawn (without message style)' : set.reason
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const isOn = (await $.store.get(STORE_ON)) !== false
    await update($, isOnAtom, () => isOn)
    await $.command.register({
      name: 'neon',
      description: 'NEON PILOT cockpit look: /neon on | off | demo | panel',
      argumentHint: 'on | off | demo | panel',
    })
    if (isOn) {
      const result = await applyLook($)
      if (result !== 'drawn') $.ui.status(`NEON PILOT: ${result}`)
      void $.ui.open({ id: PANE, title: PANE_TITLE })
    }
    await refresh($, true)
    await watchCombat($)
    $.clock.every(5000, () => {
      void refresh($, false)
      void watchCombat($)
    })
    return next(e)
  })

  on('command.run', { command: 'neon' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off') {
      await update($, isOnAtom, () => false)
      await $.store.set(STORE_ON, false)
      await $.theme.clear()
      await $.ui.close({ id: PANE })
      $.ui.status(undefined)
      return { text: 'NEON PILOT 已关闭（主题、驾驶舱面板、提示全部停用）。/neon on 可重新开启。' }
    }
    if (arg === 'panel') {
      await $.ui.open({ id: PANE, title: PANE_TITLE })
      return { text: 'NEON PILOT 驾驶舱面板已打开。' }
    }
    if (arg === 'demo') {
      await update($, isOnAtom, () => true)
      await $.ui.open({ id: PANE, title: PANE_TITLE })
      const steps: Array<[FlashKind, string, string]> = [
        ['check', '推送前先跑 lint + test', 'pre-push · T-3 s'],
        ['launch', 'PR 已推送', 'git push origin HEAD'],
        ['green', '48 / 48 测试通过', 'npm test · 2.1 s'],
        ['clear', '长任务完成，用时 4:12', '17 files · 12 tool calls'],
        ['contact', '骷髅骑士「auth › login」· HP 4', 'BOSS-FIGHT · ELITE'],
        ['down', '骷髅骑士「auth › login」· 3 回合', 'BOSS-FIGHT · CLEAR'],
      ]
      steps.forEach(([k, sub, detail], i) => {
        $.clock.after(1 + i * 2200, () => {
          void flash($, k, sub, detail)
        })
      })
      return { text: 'NEON PILOT 演示：驾驶舱面板里依次播放 SYSTEM CHECK → LAUNCH → ALL GREEN → MISSION CLEAR → ENEMY CONTACT → TARGET DOWN。' }
    }
    await update($, isOnAtom, () => true)
    await $.store.set(STORE_ON, true)
    const result = await applyLook($)
    $.ui.status(result === 'drawn' ? undefined : `NEON PILOT: ${result}`)
    await $.ui.open({ id: PANE, title: PANE_TITLE })
    await refresh($, true)
    return {
      text: `NEON PILOT 已开启（${result}）。/neon demo 预览提示。${await otherLooksOn($, 'neon-pilot')}`,
    }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== $.plugin.name || e.props.scene !== SCENE_ID) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const { Svg } = $.ui.resolve(e)
    return <Svg source={SCENE} alt="NEON PILOT: a night hangar with the mecha KX-07" />
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const hud = await read($, hudAtom)
    const fl = await read($, flashAtom)
    const combat = await readCombat($)
    const stage = stageOf(hud)
    if (e.surface === 'desktop' || e.surface === 'mobile') {
      const els = $.ui.resolve(e)
      if ('Svg' in els) {
        const { Svg } = els
        const H = dashHeight(e.props.bodyColumns, e.props.scroll.bodyRows)
        return (
          <Svg
            source={cockpitSvg(hud, fl, IMG, Date.now(), H, combat)}
            alt={`NEON PILOT 驾驶舱：${stage} · ${STAGE_ZH[stage]}，LINK ${hud.pct}%，${hud.turns} turns，${hud.tools} tool calls${isEngaged(combat) ? `，交战中：${combat.kind} HP ${combat.hp}/${combat.maxHp}` : ''}`}
          />
        )
      }
    }
    const { Box, Text } = $.ui.resolve(e)
    const sc = stageColor(stage)
    return (
      <Box flexDirection="column">
        {fl && (
          <Text color={FLASH[fl.kind].fg} bold>
            ▌{FLASH[fl.kind].title} · {FLASH[fl.kind].zh} — {fl.sub}
          </Text>
        )}
        {!fl && isEngaged(combat) && (
          <Text color={C.magenta} bold>
            ▌ENEMY LOCK · 交战中 — {combat.kind}「{clip(combat.name, 20)}」HP {combat.hp}/{combat.maxHp}
          </Text>
        )}
        <Text color={sc} bold>
          {stage} · {STAGE_ZH[stage]}
        </Text>
        <Text color={sc}>
          LINK {barText(hud.pct)} {hud.pct}%
        </Text>
        <Text color={C.dim}>
          {hud.model} │ {hud.repo} │ {hud.branch}
        </Text>
        <Text color={C.dim}>
          {hud.turns} turns · {hud.tools} tool calls
          {hud.usd === undefined ? '' : ` · $${hud.usd.toFixed(2)}`}
        </Text>
      </Box>
    )
  })

  // While the look is on, the dashboard carries the figures: hide usage-band's row above the prompt.
  on('ui.render', { component: 'AbovePromptList' }, async ($, e, next) => {
    if (!(await read($, isOnAtom))) return next(e)
    return next({ ...e, props: { ...e.props, rows: e.props.rows.filter(row => !HIDDEN_ROWS.has(row.plugin)) } })
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      turnStartedAt = Date.now()
      await update($, hudAtom, h => ({ ...h, isWorking: true }))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) {
      const ms = turnStartedAt ? Date.now() - turnStartedAt : e.durationMs
      turnStartedAt = 0
      await update($, hudAtom, h => ({ ...h, isWorking: false, isLong: false, lastTurnMs: ms }))
      if (!e.isAborted && ms > LONG_MS) {
        await flash($, 'clear', `长任务完成，用时 ${fmtDur(ms)}`, `T+${fmtDur(ms)}`)
      }
      await refresh($, true)
    }
    return r
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) await update($, hudAtom, h => ({ ...h, tools: h.tools + 1 }))

    // GitHub MCP / other tools that open a PR
    if (e.tool !== 'Bash') {
      const ran = await next(e)
      if (/create_pull_request|pr_create|create_pr/i.test(String(e.tool)) && !ran.deny && !ran.isError) {
        await flash($, 'launch', 'PR 已创建', clip(String(e.tool).replace(/^mcp__/, ''), 40))
      }
      return ran
    }

    const cmd = e.command
    const isPush = PUSH_RE.test(cmd)
    const isPr = PR_RE.test(cmd)
    const isTest = TEST_RE.test(cmd)

    // Before the push runs: the system check.
    if (isPush) {
      const recent = Date.now() - 15 * 60 * 1000
      const tested = testsPassedAt > recent
      const linted = lintRanAt > recent
      const sub =
        tested && linted
          ? '自检完成：lint + test 已通过，准备出击'
          : `推送前先跑 lint + test（${linted ? '' : 'lint 未跑'}${!linted && !tested ? ' · ' : ''}${tested ? '' : 'test 未跑'}）`
      await flash($, 'check', sub, 'pre-push · T-3 s')
    }

    const ran = await next(e)
    const ok = ran.deny === undefined && ran.isError !== true
    const text = ran.text ?? ''

    if (ok && LINT_RE.test(cmd)) lintRanAt = Date.now()

    if (ok && isTest && !FAIL_RE.test(text)) {
      testsPassedAt = Date.now()
      const n = passedCount(text)
      await flash($, 'green', n ? `${n} / ${n} 测试通过` : '测试全部通过', clip(cmd, 40))
    }

    if (ok && (isPush || isPr)) {
      const url = text.match(/https:\/\/github\.com\/\S+\/pull\/\d+/)?.[0]
      await flash(
        $,
        'launch',
        isPr ? (url ? `PR 已创建 · #${url.split('/').pop()}` : 'PR 已创建') : '已推送到远端',
        clip(cmd, 40),
      )
    }

    if (isPush || /\bgit\s+(checkout|switch|branch)\b/.test(cmd)) void refresh($, true)
    if (isTest) $.clock.after(300, () => void watchCombat($))
    return ran
  })
}
