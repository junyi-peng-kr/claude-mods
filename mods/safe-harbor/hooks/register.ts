// SAFE HARBOR: three levels of guard on the tool calls Claude makes.
//  - block: refused outright (rm -rf /, wiping a disk, force-pushing to main, writing SSH keys).
//  - ask:   put to you even when the session's mode would allow it (force-push, reset --hard, DROP TABLE, curl | sh, .env).
//  - warn:  allowed, with a toast (sudo, chmod 777, --no-verify).
//  - The status line counts what it stopped; /harbor lists, tests and edits the rules.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Event, Level, Rule, Target, Tally } from '../types'
import { BUILT_IN, LEVEL_ZH, compile, normalize, strongest } from './rules'

const STORE_CUSTOM = 'safe-harbor.custom'
const STORE_DISABLED = 'safe-harbor.disabled'
const STORE_ON = 'safe-harbor.isOn'
const FILE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])

const EMPTY: Tally = { block: 0, ask: 0, warn: 0, recent: [] }
const tallyAtom = atom({ plugin: 'safe-harbor', key: 'tally' } as const, EMPTY, { shape: 'tally-1' })

// Module state, rebuilt by session.start after a reload.
let custom: Rule[] = []
let disabled = new Set<string>()
let isOn = true
const askedIds = new Set<string>()

const active = (): Rule[] => [...BUILT_IN.filter(r => !disabled.has(r.id)), ...custom]

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function statusText(t: Tally): string {
  if (!isOn) return '⚓ 安全港 · 已关闭'
  if (t.block + t.ask + t.warn === 0) return '⚓ 安全港 · 守护中'
  return `⚓ 安全港 · 拦截 ${t.block} · 确认 ${t.ask} · 提醒 ${t.warn}`
}

async function record($: EngineInterface, rule: Rule, detail: string) {
  const event: Event = { at: Date.now(), level: rule.level, label: rule.label, detail: clip(detail, 120), ruleId: rule.id }
  const next = await update($, tallyAtom, t => ({
    ...t,
    [rule.level]: t[rule.level] + 1,
    recent: [event, ...t.recent].slice(0, 20),
  }))
  $.ui.status(statusText(next))
}

/** What a call's input says, per target: the command line, or the path written. */
function subjectOf(tool: string, input: unknown): { target: Target; text: string } | undefined {
  const i = (input ?? {}) as { command?: unknown; file_path?: unknown; notebook_path?: unknown }
  if (tool === 'Bash' && typeof i.command === 'string') return { target: 'bash', text: normalize(i.command) }
  if (FILE_TOOLS.has(tool)) {
    const path = typeof i.file_path === 'string' ? i.file_path : typeof i.notebook_path === 'string' ? i.notebook_path : undefined
    if (path) return { target: 'file', text: path }
  }
  return undefined
}

function judge(tool: string, input: unknown): { rule: Rule; text: string } | undefined {
  if (!isOn) return undefined
  const subject = subjectOf(tool, input)
  if (!subject) return undefined
  const rule = strongest(active(), subject.target, subject.text)
  return rule ? { rule, text: subject.text } : undefined
}

function ruleLine(r: Rule): string {
  const off = disabled.has(r.id) ? '（已停用）' : ''
  return `  [${LEVEL_ZH[r.level]}] ${r.id}${r.isBuiltIn ? '' : ' ·自定义'} · ${r.target} · ${r.label}${off}`
}

const LEVELS: Level[] = ['block', 'ask', 'warn']

async function harbor($: EngineInterface, args: string): Promise<string> {
  const [verb = '', ...rest] = args.trim().split(/\s+/).filter(Boolean)
  switch (verb.toLowerCase()) {
    case '':
    case 'log': {
      const t = await read($, tallyAtom)
      const lines = t.recent
        .slice(0, 10)
        .map(ev => `  ${new Date(ev.at).toTimeString().slice(0, 5)} [${LEVEL_ZH[ev.level]}] ${ev.label} — ${ev.detail}`)
      return [
        statusText(t),
        lines.length ? `最近的记录：\n${lines.join('\n')}` : '本次会话还没有触发任何规则。',
        '命令：/harbor rules | test <命令> | add <block|ask|warn> <bash|file> <正则> [-- 说明] | rm <id> | enable <id> | reset | on | off',
      ].join('\n')
    }
    case 'rules':
      return [
        `${active().length} 条规则生效${isOn ? '' : '（安全港已关闭）'}：`,
        ...LEVELS.flatMap(level => [...BUILT_IN, ...custom].filter(r => r.level === level).map(ruleLine)),
      ].join('\n')
    case 'test': {
      const command = rest.join(' ')
      if (!command) return '用法：/harbor test <命令或路径>'
      const hits = (['bash', 'file'] as const).flatMap(target => {
        const rule = strongest(active(), target, target === 'bash' ? normalize(command) : command)
        return rule ? [`  作为${target === 'bash' ? '命令' : '文件路径'}：[${LEVEL_ZH[rule.level]}] ${rule.id} · ${rule.label}`] : []
      })
      return hits.length ? `「${clip(command, 60)}」会触发：\n${hits.join('\n')}` : `「${clip(command, 60)}」不会触发任何规则。`
    }
    case 'add': {
      const [level, target, ...tail] = rest
      const joined = tail.join(' ')
      const [pattern = '', label] = joined.split(/\s+--\s+/, 2)
      if (!LEVELS.includes(level as Level) || (target !== 'bash' && target !== 'file') || !pattern) {
        return '用法：/harbor add <block|ask|warn> <bash|file> <正则> [-- 说明]\n例：/harbor add ask bash \\bprisma\\s+migrate\\s+reset -- 重置数据库'
      }
      if (!compile(pattern)) return `正则写错了：${pattern}`
      const id = `my-${custom.length + 1}-${Date.now().toString(36).slice(-4)}`
      const rule: Rule = { id, level: level as Level, target, pattern, label: label?.trim() || pattern }
      custom = [...custom, rule]
      await $.store.set(STORE_CUSTOM, custom)
      return `已添加：${ruleLine(rule).trim()}`
    }
    case 'rm':
    case 'disable': {
      const id = rest[0] ?? ''
      if (custom.some(r => r.id === id)) {
        custom = custom.filter(r => r.id !== id)
        await $.store.set(STORE_CUSTOM, custom)
        return `已删除自定义规则 ${id}。`
      }
      if (BUILT_IN.some(r => r.id === id)) {
        disabled = new Set([...disabled, id])
        await $.store.set(STORE_DISABLED, [...disabled])
        return `已停用内置规则 ${id}。/harbor enable ${id} 可恢复。`
      }
      return `没有 id 为「${id}」的规则。/harbor rules 查看全部。`
    }
    case 'enable': {
      const id = rest[0] ?? ''
      if (!disabled.has(id)) return `${id} 没有被停用。`
      disabled.delete(id)
      await $.store.set(STORE_DISABLED, [...disabled])
      return `已恢复内置规则 ${id}。`
    }
    case 'reset':
      custom = []
      disabled = new Set()
      await $.store.set(STORE_CUSTOM, [])
      await $.store.set(STORE_DISABLED, [])
      return '已恢复默认规则（删除所有自定义规则，重新启用全部内置规则）。'
    case 'off':
      isOn = false
      await $.store.set(STORE_ON, false)
      $.ui.status(statusText(await read($, tallyAtom)))
      return '安全港已关闭：不再拦截、确认或提醒。/harbor on 重新开启。'
    case 'on':
      isOn = true
      await $.store.set(STORE_ON, true)
      $.ui.status(statusText(await read($, tallyAtom)))
      return '安全港已开启。'
    default:
      return `不认识「${verb}」。/harbor 查看用法。`
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    custom = ((await $.store.get(STORE_CUSTOM)) as Rule[] | undefined) ?? []
    disabled = new Set(((await $.store.get(STORE_DISABLED)) as string[] | undefined) ?? [])
    isOn = (await $.store.get(STORE_ON)) !== false
    await $.command.register({
      name: 'harbor',
      description: 'Safe Harbor guard rules: /harbor [log | rules | test <cmd> | add | rm <id> | enable <id> | reset | on | off]',
      argumentHint: 'log | rules | test <cmd> | add <level> <bash|file> <regex> [-- label] | rm <id> | on | off',
    })
    $.ui.status(statusText(await read($, tallyAtom)))
    return next(e)
  })

  on('command.run', { command: 'harbor' }, async ($, e) => ({ text: await harbor($, e.args) }))

  // block and warn: decided before the call goes on.
  on('tool.call', async ($, e, next) => {
    const hit = judge(String(e.tool), e)
    if (hit?.rule.level === 'block') {
      await record($, hit.rule, hit.text)
      $.ui.toast(`⚓ 已拦截：${hit.rule.label}`, { timeoutMs: 7000 })
      return {
        deny: `Safe Harbor blocked this call: ${hit.rule.label} (rule ${hit.rule.id}). Do not try to get around it with another command; tell the user what you wanted to do and let them run it themselves if they really mean it.`,
      }
    }
    if (hit?.rule.level === 'warn') {
      await record($, hit.rule, hit.text)
      $.ui.toast(`⚓ 提醒：${hit.rule.label} — ${clip(hit.text, 60)}`, { timeoutMs: 6000 })
    }
    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'Safe Harbor could not check this call, so it was refused.' }))

  // ask: put to the person even where the mode or a rule would allow it.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'deny') return verdict
    const hit = judge(e.tool, e.input)
    if (!hit || hit.rule.level !== 'ask') return verdict
    if (e.tool_use_id && !askedIds.has(e.tool_use_id)) {
      askedIds.add(e.tool_use_id)
      await record($, hit.rule, hit.text)
    }
    return { decision: 'ask', reason: `⚓ 安全港：${hit.rule.label}。确认要执行吗？` }
  }).catch(() => ({ decision: 'ask', reason: '⚓ 安全港没能检查这次调用，请人工确认。' }))
}
