// NARRATOR: a storyteller's line for whatever Claude is doing, from templates.
//  - Status line: one line per tool call, in the chosen voice.
//  - Toasts at the moments that matter: the first tool of a turn, a test run's
//    result, a commit, a push, a long turn finishing. At most one every 20 s,
//    except results (tests, commits, pushes, a long turn), which always show.
//  - Voices: 武侠 (wuxia), 侦探 (detective), 太空歌剧 (space), 纪录片 (docu).
//  - /narrator [wuxia | detective | space | docu | on | off | sample]
import type { EngineInterface, Register } from 'claude-code'

import type { Beat, Voice } from '../types'
import { LINES, VOICE_ALIASES, VOICE_ZH, fill, pick } from './voices'

const STORE_VOICE = 'narrator.voice'
const STORE_ON = 'narrator.isOn'
const TOAST_GAP_MS = 20_000
const LONG_TURN_MS = 2 * 60 * 1000

const TEST_RE =
  /(^|[\s;&|(])((npm|pnpm|yarn|bun)\s+(run\s+)?test\b|npx\s+(jest|vitest|mocha|playwright)\b|(jest|vitest|pytest|mocha|rspec|phpunit)\b|go\s+test\b|cargo\s+(test|nextest)\b|python3?\s+-m\s+(pytest|unittest)\b|make\s+test\b|deno\s+test\b|swift\s+test\b|mvn\s+test\b|gradle\w*\s+test\b)/
const FAIL_RE = /\b[1-9]\d*\s+(failed|failing|failures?)\b|\bFAIL(ED)?\b|Tests?:\s+[1-9]\d*\s+failed/
const COMMIT_RE = /(^|[\s;&|(])git\s+(?:-C\s+\S+\s+)?commit\b/
const PUSH_RE = /(^|[\s;&|(])git\s+push\b/

// Module state: a reload starts it over, and session.start reads the settings back.
let voice: Voice = 'wuxia'
let isOn = true
let lastToastAt = 0
let turnStartedAt = 0
let isFirstTool = false
let readsThisTurn = 0
const lastPick = new Map<string, number>()

const clip = (s: string, n: number) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}
const base = (p: string) => p.split('/').filter(Boolean).pop() ?? p

function minutes(ms: number): string {
  const m = Math.round(ms / 60000)
  return m < 60 ? `${m} 分钟` : `${Math.floor(m / 60)} 小时 ${m % 60} 分`
}

/** The beat a tool call plays, and what it's about. */
export function beatOf(tool: string, e: Record<string, unknown>): { beat: Beat; subject: string } {
  const s = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '')
  const path = s('file_path') || s('notebook_path')
  switch (tool) {
    case 'Read':
    case 'NotebookRead':
      return { beat: 'read', subject: base(path) || '卷宗' }
    case 'Grep':
    case 'Glob':
    case 'ToolSearch':
      return { beat: 'search', subject: clip(s('pattern') || s('query'), 24) }
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return { beat: 'edit', subject: base(path) }
    case 'Write':
      return { beat: 'write', subject: base(path) }
    case 'Bash':
    case 'PowerShell':
      return { beat: 'exec', subject: clip(s('description') || s('command'), 28) }
    case 'Agent':
    case 'Task':
      return { beat: 'agent', subject: clip(s('description') || s('prompt'), 24) }
    case 'WebFetch':
      return { beat: 'web', subject: clip(s('url').replace(/^https?:\/\//, '').split('/')[0] ?? '', 30) }
    case 'WebSearch':
      return { beat: 'web', subject: clip(s('query'), 24) }
    default:
      return { beat: 'other', subject: tool.replace(/^mcp__.*?__/, '') }
  }
}

export function line(beat: Beat, subject: string, n = 1): string {
  return fill(pick(voice, beat, lastPick), subject, n)
}

/** A toast, unless one showed in the last 20 s; results always show. */
function tell($: EngineInterface, text: string, isResult: boolean) {
  const now = Date.now()
  if (!isResult && now - lastToastAt < TOAST_GAP_MS) return
  lastToastAt = now
  $.ui.toast(`📖 ${text}`, { timeoutMs: 6000 })
}

const status = ($: EngineInterface, text: string | undefined) => $.ui.status(text === undefined ? undefined : `📖 ${clip(text, 70)}`)

function sample(): string {
  const beats: Array<[Beat, string]> = [
    ['first', ''],
    ['read', 'auth.ts'],
    ['search', 'refreshToken'],
    ['edit', 'auth.ts'],
    ['exec', 'npm run build'],
    ['pass', '48 项'],
    ['fail', '2 处'],
    ['commit', 'Fix token refresh'],
    ['done', '4 分钟'],
  ]
  return [`旁白 · ${VOICE_ZH[voice]}：`, ...beats.map(([b, f]) => `  ${fill(pick(voice, b, lastPick), f, 3)}`)].join('\n')
}

async function commitSubject($: EngineInterface, cmd: string): Promise<string> {
  const m = cmd.match(/-m\s+(["'])([\s\S]*?)\1/)
  if (m?.[2]) return clip(m[2].split('\n')[0] ?? '', 40)
  try {
    const r = await $.process.run(['git', 'log', '-1', '--format=%s'], { timeoutMs: 3000 })
    if (r.exitCode === 0 && r.stdout.trim()) return clip(r.stdout.trim(), 40)
  } catch {
    // fall through
  }
  return '新的一页'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = await $.store.get(STORE_VOICE)
    voice = typeof stored === 'string' && stored in LINES ? (stored as Voice) : 'wuxia'
    isOn = (await $.store.get(STORE_ON)) !== false
    await $.command.register({
      name: 'narrator',
      description: 'Narrate what Claude does: /narrator wuxia | detective | space | docu | on | off | sample',
      argumentHint: 'wuxia | detective | space | docu | on | off | sample',
    })
    if (isOn) status($, line('idle', ''))
    return next(e)
  })

  on('command.run', { command: 'narrator' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off') {
      isOn = false
      await $.store.set(STORE_ON, false)
      status($, undefined)
      return { text: '旁白已退场。/narrator on 请回来。' }
    }
    if (arg === 'sample') return { text: sample() }
    const chosen = VOICE_ALIASES[arg]
    if (arg && arg !== 'on' && !chosen) return { text: '用法：/narrator wuxia | detective | space | docu | on | off | sample' }
    if (chosen) {
      voice = chosen
      await $.store.set(STORE_VOICE, voice)
    }
    isOn = true
    await $.store.set(STORE_ON, true)
    const opening = line('first', '')
    status($, opening)
    return { text: `旁白 · ${VOICE_ZH[voice]}：${opening}` }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      turnStartedAt = Date.now()
      isFirstTool = true
      readsThisTurn = 0
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (!isOn || e.agentId !== undefined) return next(e)
    const tool = String(e.tool)
    const fields = e as unknown as Record<string, unknown>
    const { beat, subject } = beatOf(tool, fields)
    if (beat === 'read') readsThisTurn += 1
    const now = line(beat, subject, Math.max(1, readsThisTurn))
    status($, now)
    if (isFirstTool) {
      isFirstTool = false
      tell($, `${line('first', '')} ${now}`, false)
    }

    const ran = await next(e)
    if (tool !== 'Bash' || ran.deny !== undefined) return ran
    const cmd = String(fields.command ?? '')
    const text = ran.text ?? ''
    const isOk = ran.isError !== true
    if (TEST_RE.test(cmd)) {
      if (isOk && !FAIL_RE.test(text)) {
        const n = text.match(/(\d+)\s+(?:passed|passing)/i)?.[1]
        const result = line('pass', n ? `${n} 项` : '全部')
        status($, result)
        tell($, result, true)
      } else {
        const n = text.match(/(\d+)\s+(?:failed|failing)/i)?.[1]
        const result = line('fail', n ? `${n} 处` : '有')
        status($, result)
        tell($, result, true)
      }
    } else if (isOk && COMMIT_RE.test(cmd)) {
      const result = line('commit', await commitSubject($, cmd))
      status($, result)
      tell($, result, true)
    } else if (isOk && PUSH_RE.test(cmd)) {
      const result = line('push', '')
      status($, result)
      tell($, result, true)
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!isOn || e.agentId !== undefined) return r
    const ms = turnStartedAt ? Date.now() - turnStartedAt : e.durationMs
    turnStartedAt = 0
    if (!e.isAborted && ms > LONG_TURN_MS) tell($, line('done', minutes(ms)), true)
    status($, line('idle', ''))
    return r
  })
}
