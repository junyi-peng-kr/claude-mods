// TERMINAL 1983: a phosphor CRT look for Claude Code.
//  - Look (desktop app): green or amber monochrome, a scanline tube behind the
//    conversation, square mono message boxes, a low hum and beeps when sound is on.
//  - System console (side panel, every surface): each tool call as a mainframe job,
//    `JOB 0042 BASH  COMPLETE 00:02.1`.
//  - /crt [on | off | green | amber | console]
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Job, Tint } from '../types'
import { PHOSPHOR, colorsOf, lookOf, sceneId, sceneSvg } from './crt'
import { otherLooksOn } from './looks'

const PANE = 'crt-console'
const TITLE = 'SYSTEM CONSOLE · 1983'
const STORE_ON = 'terminal-1983.isOn'
const STORE_TINT = 'terminal-1983.tint'
const MAX_JOBS = 300

const jobsAtom = atom({ plugin: 'terminal-1983', key: 'jobs' } as const, [], { shape: 'jobs-1' })
const tintAtom = atom({ plugin: 'terminal-1983', key: 'tint' } as const, 'green')
const isOnAtom = atom({ plugin: 'terminal-1983', key: 'isOn' } as const, false)

let jobSeq = 0
const SCENES = new Set([sceneId('green'), sceneId('amber')])

async function applyLook($: EngineInterface, tint: Tint): Promise<string> {
  const unpainted = colorsOf(tint).problems.find(line => line.startsWith("Desktop won't paint"))
  if (unpainted !== undefined) $.ui.log(`TERMINAL 1983: ${unpainted}`, { to: 'debug' })
  try {
    const set = await $.theme.set(lookOf(tint, true))
    return set.isDrawn ? 'drawn' : set.reason
  } catch (error) {
    // A build without sound or style refuses the whole set: step down.
    $.ui.log(`TERMINAL 1983: ${String(error)}`, { to: 'debug' })
    try {
      const set = await $.theme.set(lookOf(tint, false))
      return set.isDrawn ? 'drawn (no sound)' : set.reason
    } catch (again) {
      const { style: _style, ...plain } = lookOf(tint, false)
      const set = await $.theme.set(plain)
      return set.isDrawn ? 'drawn (colors and backdrop only)' : set.reason
    }
  }
}

const pad = (n: number, w: number) => String(n).padStart(w, '0')
const clock = (ms: number) => {
  const s = Math.max(0, ms) / 1000
  return `${pad(Math.floor(s / 60), 2)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}
const cut = (s: string, n: number) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}

function labelOf(tool: string, e: Record<string, unknown>): string {
  const pick = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '')
  const path = pick('file_path') || pick('notebook_path')
  if (path) return path.split('/').pop() ?? path
  return pick('description') || pick('command') || pick('pattern') || pick('url') || pick('query') || pick('prompt')
}

const STATUS_WORD: Record<Job['status'], string> = { run: 'EXECUTING', ok: 'COMPLETE', abend: 'ABEND', held: 'HELD' }

export function jobLine(j: Job, now: number): string {
  const name = j.tool.replace(/^mcp__.*?__/, '').toUpperCase().slice(0, 9).padEnd(9)
  const tail = j.status === 'run' ? clock(now - j.start) : clock((j.end ?? now) - j.start)
  return `JOB ${pad(j.n % 10000, 4)} ${name} ${STATUS_WORD[j.status].padEnd(9)} ${tail}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Off until you turn it on: only one look shows at a time.
    const isOn = (await $.store.get(STORE_ON)) === true
    const stored = await $.store.get(STORE_TINT)
    const tint: Tint = stored === 'amber' ? 'amber' : 'green'
    await update($, isOnAtom, () => isOn)
    await update($, tintAtom, () => tint)
    await $.command.register({
      name: 'crt',
      description: 'TERMINAL 1983 phosphor look: /crt on | off | green | amber | console',
      argumentHint: 'on | off | green | amber | console',
    })
    if (isOn) {
      const result = await applyLook($, tint)
      if (!result.startsWith('drawn')) $.ui.status(`▮ TERMINAL 1983: ${result}`)
    }
    return next(e)
  })

  on('command.run', { command: 'crt' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off') {
      await update($, isOnAtom, () => false)
      await $.store.set(STORE_ON, false)
      await $.theme.clear()
      await $.ui.close({ id: PANE })
      $.ui.status(undefined)
      return { text: 'TERMINAL 1983 已关闭。/crt on 重新开机。' }
    }
    if (arg === 'console') {
      await $.ui.open({ id: PANE, title: TITLE })
      return { text: '系统控制台已打开。' }
    }
    const tint: Tint = arg === 'amber' ? 'amber' : arg === 'green' ? 'green' : await read($, tintAtom)
    await update($, tintAtom, () => tint)
    await update($, isOnAtom, () => true)
    await $.store.set(STORE_TINT, tint)
    await $.store.set(STORE_ON, true)
    const result = await applyLook($, tint)
    $.ui.status(result.startsWith('drawn') ? undefined : `▮ TERMINAL 1983: ${result}`)
    return {
      text: `TERMINAL 1983 · ${tint === 'green' ? 'P1 绿色荧光' : 'P3 琥珀荧光'}（${result}）。打开桌面端标题栏的喇叭能听到显像管的嗡声。${await otherLooksOn($, 'terminal-1983')}`,
    }
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== $.plugin.name || !SCENES.has(e.props.scene)) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const { Svg } = $.ui.resolve(e)
    const tint: Tint = e.props.scene === sceneId('amber') ? 'amber' : 'green'
    return <Svg source={sceneSvg(tint)} alt="A glowing CRT screen with fine scanlines" isInteractive />
  })

  on('tool.call', async ($, e, next) => {
    const job: Job = {
      n: ++jobSeq,
      tool: String(e.tool),
      label: cut(labelOf(String(e.tool), e as unknown as Record<string, unknown>), 48),
      start: Date.now(),
      status: 'run',
    }
    await update($, jobsAtom, list => [...list, job].slice(-MAX_JOBS))
    let status: Job['status'] = 'abend'
    try {
      const ran = await next(e)
      status = ran.deny !== undefined ? 'held' : ran.isError === true ? 'abend' : 'ok'
      return ran
    } finally {
      const end = Date.now()
      await update($, jobsAtom, list => list.map(j => (j.n === job.n ? { ...j, end, status } : j)))
    }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const jobs = await read($, jobsAtom)
    const tint = await read($, tintAtom)
    const p = PHOSPHOR[tint]
    const { Box, Text } = $.ui.resolve(e)
    const now = Date.now()
    const room = Math.max(4, (e.props.scroll.bodyRows || 24) - 6)
    const done = jobs.filter(j => j.status === 'ok').length
    const abends = jobs.filter(j => j.status === 'abend').length
    const color = (j: Job) => (j.status === 'abend' ? p.roles.danger : j.status === 'held' ? p.roles.warning : j.status === 'run' ? p.glow : p.secondary)

    return (
      <Box flexDirection="column">
        <Text bold color={p.glow}>
          CLAUDE/OS 1983 · SYSTEM CONSOLE
        </Text>
        <Text color={p.muted}>
          {jobs.length} JOBS · {done} COMPLETE · {abends} ABEND
        </Text>
        <Text color={p.muted}>{'─'.repeat(Math.max(10, Math.min(48, (e.props.bodyColumns || 40) - 2)))}</Text>
        {jobs.length === 0 && <Text color={p.secondary}>READY.</Text>}
        {jobs.slice(-Math.max(2, Math.floor(room / 2))).map(j => (
          <Box flexDirection="column">
            <Text color={color(j)}>{jobLine(j, now)}</Text>
            {j.label && <Text color={p.muted}>{`         ${cut(j.label, 40)}`}</Text>}
          </Box>
        ))}
        <Text color={p.glow}>█</Text>
      </Box>
    )
  })
}
