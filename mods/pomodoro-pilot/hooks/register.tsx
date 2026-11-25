// POMODORO PILOT: a pomodoro timer that paces the person, not the model.
//  - /pomo start [min] (25), /pomo break [min] (5), /pomo stop, /pomo status, /pomo (panel).
//  - The status line counts down: 🍅 18:20 专注中 · 今日 2.
//  - When focus ends: a toast, the count for today goes up, and a break starts
//    (15 minutes after every 4th pomodoro of the day, 5 otherwise).
//  - During a break: the first prompt you send gets one gentle reminder, and a
//    long task (a turn over a minute) that finishes is announced only once the break ends.
//  - It never touches the theme, so it sits beside any look.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Phase, Pomo } from '../types'

const PANE = 'pomodoro-pilot'
const TITLE = 'POMODORO · 番茄领航'
const STORE_DAYS = 'pomodoro-pilot.days'
const FOCUS_MIN = 25
const BREAK_MIN = 5
const LONG_BREAK_MIN = 15
const LONG_TURN_MS = 60_000
const TICK_MS = 10_000

const IDLE: Pomo = { phase: 'idle', startedAt: 0, endsAt: 0, minutes: 0, held: [], isReminded: false, days: [] }
const pomoAtom = atom({ plugin: 'pomodoro-pilot', key: 'pomo' } as const, IDLE, { shape: 'pomo-1' })

// When the current main turn started; a reload starts it over.
let turnStartedAt = 0

export const dayOf = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const countOn = (days: Pomo['days'], day: string) => days.find(([d]) => d === day)?.[1] ?? 0

export function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function statusText(p: Pomo, now: number): string | undefined {
  const today = countOn(p.days, dayOf(now))
  const tail = today ? ` · 今日 ${today}` : ''
  if (p.phase === 'focus') return `🍅 ${mmss(p.endsAt - now)} 专注中${tail}`
  if (p.phase === 'break') return `☕ ${mmss(p.endsAt - now)} 休息中${tail}`
  return today ? `🍅 今日 ${today}` : undefined
}

async function show($: EngineInterface) {
  const now = await $.clock.now()
  $.ui.status(statusText(await read($, pomoAtom), now))
}

async function begin($: EngineInterface, phase: Exclude<Phase, 'idle'>, minutes: number) {
  const now = await $.clock.now()
  const endsAt = now + minutes * 60_000
  await update($, pomoAtom, p => ({ ...p, phase, minutes, startedAt: now, endsAt, isReminded: false }))
  // A precise end; the tick below catches an end this misses (after a reload).
  $.clock.after(minutes * 60_000, () => void finish($, phase, endsAt))
  await show($)
}

/** Ends the phase that ends at `endsAt`, once. */
async function finish($: EngineInterface, phase: Exclude<Phase, 'idle'>, endsAt: number) {
  const p = await read($, pomoAtom)
  if (p.phase !== phase || p.endsAt !== endsAt) return
  const now = await $.clock.now()
  if (phase === 'focus') {
    const day = dayOf(now)
    const count = countOn(p.days, day) + 1
    const days: Pomo['days'] = [...p.days.filter(([d]) => d !== day), [day, count] as [string, number]].slice(-14)
    await update($, pomoAtom, cur => ({ ...cur, days }))
    await $.store.set(STORE_DAYS, days)
    const rest = count % 4 === 0 ? LONG_BREAK_MIN : BREAK_MIN
    $.ui.toast(`🍅 专注 ${p.minutes} 分钟完成！今天第 ${count} 个。起来活动一下，休息 ${rest} 分钟。`, { timeoutMs: 10000 })
    await begin($, 'break', rest)
    return
  }
  const held = p.held
  await update($, pomoAtom, (cur): Pomo => ({ ...cur, phase: 'idle', startedAt: 0, endsAt: 0, held: [], isReminded: false }))
  $.ui.toast(
    held.length
      ? `☕ 休息结束。休息期间完成了：${held.join('；')}。/pomo start 开始下一个番茄。`
      : '☕ 休息结束。/pomo start 开始下一个番茄。',
    { timeoutMs: 10000 },
  )
  await show($)
}

async function tick($: EngineInterface) {
  const p = await read($, pomoAtom)
  if (p.phase !== 'idle' && (await $.clock.now()) >= p.endsAt) {
    await finish($, p.phase, p.endsAt)
    return
  }
  await show($)
}

async function stop($: EngineInterface): Promise<string> {
  const p = await read($, pomoAtom)
  if (p.phase === 'idle') return '现在没有在计时。'
  await update($, pomoAtom, (cur): Pomo => ({ ...cur, phase: 'idle', startedAt: 0, endsAt: 0, held: [], isReminded: false }))
  await show($)
  return p.phase === 'focus' ? '这个番茄停掉了（不计入今天的数量）。' : '休息提前结束。'
}

function minutesOf(arg: string | undefined, fallback: number): number | undefined {
  if (!arg) return fallback
  const n = Number(arg)
  return Number.isFinite(n) && n >= 1 && n <= 180 ? Math.round(n) : undefined
}

async function startFocus($: EngineInterface, minutes = FOCUS_MIN): Promise<string> {
  await begin($, 'focus', minutes)
  return `🍅 开始专注 ${minutes} 分钟。`
}

async function startBreak($: EngineInterface, minutes = BREAK_MIN): Promise<string> {
  await begin($, 'break', minutes)
  return `☕ 休息 ${minutes} 分钟。`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pomo',
      description: 'Pomodoro timer: /pomo start [min] | break [min] | stop | status',
      argumentHint: 'start [min] | break [min] | stop | status',
    })
    const days = (await $.store.get(STORE_DAYS)) as Pomo['days'] | undefined
    if (days) await update($, pomoAtom, p => ({ ...p, days }))
    $.clock.every(TICK_MS, () => void tick($))
    await tick($)
    return next(e)
  })

  on('command.run', { command: 'pomo' }, async ($, e) => {
    const [verb = '', arg] = e.args.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (verb === 'start' || verb === 'break') {
      const minutes = minutesOf(arg, verb === 'start' ? FOCUS_MIN : BREAK_MIN)
      if (minutes === undefined) return { text: `用法：/pomo ${verb} [1 到 180 分钟]` }
      return { text: verb === 'start' ? await startFocus($, minutes) : await startBreak($, minutes) }
    }
    if (verb === 'stop') return { text: await stop($) }
    if (verb === 'status') {
      const p = await read($, pomoAtom)
      const now = await $.clock.now()
      const today = countOn(p.days, dayOf(now))
      const week = p.days.slice(-7).reduce((n, [, c]) => n + c, 0)
      return {
        text: [
          p.phase === 'idle' ? '没有在计时。' : `${p.phase === 'focus' ? '🍅 专注' : '☕ 休息'}中，还剩 ${mmss(p.endsAt - now)}。`,
          `今天完成 ${today} 个番茄，最近 7 天 ${week} 个。`,
        ].join('\n'),
      }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: '番茄面板已打开。' }
  })

  on('prompt.submit', async ($, e, next) => {
    const p = await read($, pomoAtom)
    if (p.phase === 'break' && !p.isReminded && !e.isMeta) {
      await update($, pomoAtom, cur => ({ ...cur, isReminded: true }))
      const left = mmss(p.endsAt - (await $.clock.now()))
      $.ui.toast(`☕ 还在休息时间（剩 ${left}）。任务照常进行，做完了等休息结束再告诉你。`, { timeoutMs: 7000 })
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) turnStartedAt = await $.clock.now()
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined || e.isAborted) return r
    const now = await $.clock.now()
    const ms = turnStartedAt ? now - turnStartedAt : e.durationMs
    turnStartedAt = 0
    if (ms < LONG_TURN_MS) return r
    const note = `一个 ${Math.round(ms / 60000)} 分钟的任务`
    const p = await read($, pomoAtom)
    if (p.phase === 'break') {
      await update($, pomoAtom, cur => ({ ...cur, held: [...cur.held, note].slice(-5) }))
    } else if (p.phase === 'focus') {
      $.ui.toast(`✅ ${note}完成了。`, { timeoutMs: 6000 })
    }
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const p = await read($, pomoAtom)
    const now = await $.clock.now()
    const { Box, Text, Button, Progress } = $.ui.resolve(e)
    const today = countOn(p.days, dayOf(now))
    const total = p.endsAt - p.startedAt
    const done = p.phase === 'idle' || total <= 0 ? 0 : Math.min(total, now - p.startedAt)
    const color = p.phase === 'focus' ? '#E5484D' : p.phase === 'break' ? '#3FA34D' : undefined

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold {...(color ? { color } : {})}>
          {p.phase === 'focus' ? '🍅 专注中' : p.phase === 'break' ? '☕ 休息中' : '⏸ 未计时'}
          {p.phase === 'idle' ? '' : ` · 剩 ${mmss(p.endsAt - now)}`}
        </Text>
        {p.phase !== 'idle' && (
          <Progress
            label={p.phase === 'focus' ? '专注进度' : '休息进度'}
            value={done}
            max={total}
            valueText={`${Math.floor(done / 60000)} / ${p.minutes} 分钟`}
            {...(color ? { color } : {})}
          />
        )}
        {p.phase === 'break' && p.held.length > 0 && <Text dimColor>休息结束后告诉你：{p.held.join('；')}</Text>}
        <Box flexDirection="row" gap={1}>
          {p.phase !== 'focus' && <Button key="focus" label="开始专注 25 分" variant="primary" onPress={() => startFocus($)} />}
          {p.phase === 'focus' && <Button key="break" label="提前休息" onPress={() => startBreak($)} />}
          {p.phase !== 'idle' && <Button key="stop" label="停止" dimColor onPress={() => stop($)} />}
        </Box>
        <Text>今天：{today ? '🍅'.repeat(Math.min(today, 12)) + (today > 12 ? ` ×${today}` : '') : '还没有番茄'}</Text>
        <Text dimColor>
          最近 7 天：{p.days.slice(-7).map(([d, c]) => `${d.slice(5)} ${c}`).join(' · ') || '—'}
        </Text>
      </Box>
    )
  })
}
