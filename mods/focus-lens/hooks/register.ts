// FOCUS LENS: a goal for the session, kept in view.
//  - /lens <goal> sets it; it sits in the status line as 🎯 <goal>.
//  - A system prompt section asks Claude to stay within it and to say so before
//    changing anything outside it.
//  - After each main-loop turn, the files edited are judged against the goal (path
//    words against goal words, plus files and folders already judged on it). If more
//    than half look unrelated, one gentle toast names them, once per file.
//  - /lens [<goal> | clear]
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Focus } from '../types'
import { judgeTurn, shouldWarn, wordsOf } from './match'

const SECTION_ID = 'focus-lens:goal'
const FILE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])

const NONE: Focus = { goal: '', words: [], known: [], warned: [], setAt: 0 }
const focusAtom = atom({ plugin: 'focus-lens', key: 'focus' } as const, NONE, { shape: 'focus-1' })

// The files edited in the turn under way, and the folder paths are shown relative to.
let turnFiles: string[] = []
let cwd = ''

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const base = (p: string) => p.split('/').pop() ?? p
const rel = (p: string) => (cwd && p.startsWith(`${cwd}/`) ? p.slice(cwd.length + 1) : p)

export function sectionText(goal: string): string {
  return [
    '# Session focus',
    `The user set this goal for the session with /lens: "${goal}"`,
    'Stay within it. Before you change anything outside it (an unrelated refactor, a drive-by fix, reformatting other files), say so and ask, or leave a note instead of doing it. If the goal itself needs a wider change than it suggests, explain why before making it.',
  ].join('\n')
}

const status = (f: Focus) => (f.goal ? `🎯 ${clip(f.goal, 40)}` : undefined)

async function setGoal($: EngineInterface, goal: string): Promise<Focus> {
  const next = await update($, focusAtom, () =>
    goal ? { goal, words: wordsOf(goal), known: [], warned: [], setAt: Date.now() } : NONE,
  )
  $.ui.status(status(next))
  return next
}

async function focus($: EngineInterface, args: string): Promise<string> {
  const arg = args.trim()
  if (arg.toLowerCase() === 'clear' || arg === '清除') {
    await setGoal($, '')
    return '目标已清除。'
  }
  if (arg) {
    const f = await setGoal($, clip(arg, 200))
    return [
      `🎯 本次会话的目标：${f.goal}`,
      f.words.length
        ? `用这些词判断改动是否相关：${f.words.join('、')}`
        : '目标里没有能和文件路径比对的词：会把接下来第一轮改动的文件当成相关文件。',
      'Claude 会被要求只做和目标有关的事；改动偏离时会提醒你。/lens clear 清除。',
    ].join('\n')
  }
  const f = await read($, focusAtom)
  if (!f.goal) return '还没有设定目标。用法：/lens <这次会话要做的事>，例如 /lens 修复登录页 token 过期'
  return [
    `🎯 ${f.goal}`,
    f.words.length ? `匹配词：${f.words.join('、')}` : '匹配词：（无，按已改文件学习）',
    f.known.length ? `相关文件：${f.known.slice(-8).map(base).join('、')}${f.known.length > 8 ? ` 等 ${f.known.length} 个` : ''}` : '',
    f.warned.length ? `提醒过的偏离：${f.warned.slice(-8).map(base).join('、')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    cwd = await $.session.cwd()
    await $.command.register({
      name: 'lens',
      description: 'Set a goal for this session: /lens <goal> | /lens | /lens clear',
      argumentHint: '<goal> | clear',
    })
    $.ui.status(status(await read($, focusAtom)))
    return next(e)
  })

  on('command.run', { command: 'lens' }, async ($, e) => ({ text: await focus($, e.args) }))

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const f = await read($, focusAtom)
    if (!f.goal) return composed
    const sections = composed.sections.filter(s => s.id !== SECTION_ID)
    return { sections: [...sections, { id: SECTION_ID, text: sectionText(f.goal), scope: 'session' as const }] }
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) turnFiles = []
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const tool = String(e.tool)
    if (FILE_TOOLS.has(tool) && ran.deny === undefined && ran.isError !== true) {
      const i = e as unknown as { file_path?: unknown; notebook_path?: unknown }
      const path = typeof i.file_path === 'string' ? i.file_path : typeof i.notebook_path === 'string' ? i.notebook_path : ''
      if (path) turnFiles.push(rel(path))
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined) return r
    const files = turnFiles
    turnFiles = []
    const f = await read($, focusAtom)
    if (!f.goal || files.length === 0) return r
    const verdict = judgeTurn(files, f.words, f.known)
    const fresh = shouldWarn(verdict, f.warned)
    await update($, focusAtom, cur => ({
      ...cur,
      known: [...new Set([...cur.known, ...verdict.on])].slice(-200),
      warned: [...new Set([...cur.warned, ...fresh])].slice(-200),
    }))
    if (fresh.length > 0) {
      const names = fresh.slice(0, 3).map(base).join('、') + (fresh.length > 3 ? ` 等 ${fresh.length} 个文件` : '')
      $.ui.toast(`🎯 这一轮改了 ${names}，好像超出了「${clip(f.goal, 24)}」`, { timeoutMs: 8000 })
    }
    return r
  })
}
