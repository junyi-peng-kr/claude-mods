// SECRET SNIFFER: stops secrets before they land in a file or a commit.
//  - Scans the text Claude writes (Write's content, Edit's and MultiEdit's new
//    strings, NotebookEdit's new source) and, before `git commit`, the lines the
//    commit adds (`git diff --cached -U0`, or against HEAD for `commit -a`).
//  - A hit refuses the call, naming the rule and the line with the value masked.
//    The secret itself is never echoed: not to Claude, not in a toast.
//  - /sniffer [list | test <text> | allow <regex> | unallow <regex> | on | off]
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Finding, Sniffs } from '../types'
import { DETECTORS, addedLines, scan } from './scan'

const STORE_ALLOW = 'secret-sniffer.allow'
const STORE_ON = 'secret-sniffer.isOn'
const COMMIT_RE = /(^|[\s;&|(])git\s+(?:-C\s+\S+\s+)?commit\b/
const COMMIT_ALL_RE = /\scommit\b[^;&|\n]*\s(?:-a\b|-[a-zA-Z]*a[a-zA-Z]*\b|--all\b)/

const EMPTY: Sniffs = { blocked: 0, recent: [] }
const sniffsAtom = atom({ plugin: 'secret-sniffer', key: 'sniffs' } as const, EMPTY, { shape: 'sniffs-1' })

// Settings, read again by session.start after a reload.
let allow: string[] = []
let isOn = true

type Piece = { path: string; text: string; lineNumbers?: number[] }

/** The text a file tool is about to write, in pieces with their file path. */
export function piecesOf(tool: string, input: unknown): Piece[] {
  const i = (input ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof i[k] === 'string' ? (i[k] as string) : '')
  const path = str('file_path') || str('notebook_path')
  if (tool === 'Write') return [{ path, text: str('content') }]
  if (tool === 'Edit') return [{ path, text: str('new_string') }]
  if (tool === 'NotebookEdit') return [{ path, text: str('new_source') }]
  if (tool === 'MultiEdit' && Array.isArray(i.edits)) {
    return i.edits.flatMap(ed => {
      const s = (ed as { new_string?: unknown }).new_string
      return typeof s === 'string' ? [{ path, text: s }] : []
    })
  }
  return []
}

function findAll(pieces: Piece[]): Finding[] {
  return pieces.flatMap(p =>
    scan(p.text, { allow, path: p.path, ...(p.lineNumbers ? { lineNumbers: p.lineNumbers } : {}) }),
  )
}

async function stagedPieces($: EngineInterface, command: string): Promise<Piece[]> {
  const args = COMMIT_ALL_RE.test(command) ? ['diff', 'HEAD', '-U0', '--no-color'] : ['diff', '--cached', '-U0', '--no-color']
  const r = await $.process.run(['git', ...args], { timeoutMs: 8000 })
  if (r.exitCode !== 0) return []
  return addedLines(r.stdout)
}

const where = (f: Finding) => (f.path ? `${f.path.split('/').slice(-2).join('/')}:${f.line}` : `line ${f.line}`)

export function denyText(findings: Finding[], isCommit: boolean): string {
  const shown = findings.slice(0, 5).map(f => `- ${f.label} (${f.rule}) at ${where(f)}: ${f.masked}`)
  const more = findings.length > 5 ? [`- …and ${findings.length - 5} more`] : []
  return [
    `Secret Sniffer refused this ${isCommit ? 'commit' : 'write'}: it contains what looks like ${findings.length === 1 ? 'a secret' : `${findings.length} secrets`}.`,
    ...shown,
    ...more,
    isCommit
      ? 'Unstage the file or remove the secret, and load it from an environment variable or a secret manager instead.'
      : 'Write the code to read it from an environment variable or a secret manager instead, and use a placeholder in examples. If this is a known test fixture, the user can allow it with /sniffer allow <regex>.',
  ].join('\n')
}

async function record($: EngineInterface, findings: Finding[]) {
  const at = Date.now()
  const next = await update($, sniffsAtom, s => ({
    blocked: s.blocked + 1,
    recent: [...findings.map(f => ({ ...f, at })), ...s.recent].slice(0, 20),
  }))
  const first = findings[0]!
  $.ui.toast(`🔑 已拦截：${first.label} · ${where(first)}${findings.length > 1 ? ` 等 ${findings.length} 处` : ''}`, { timeoutMs: 8000 })
  $.ui.status(`🔑 密钥嗅探 · 已拦截 ${next.blocked} 次`)
}

async function sniffer($: EngineInterface, args: string): Promise<string> {
  const trimmed = args.trim()
  const verb = (trimmed.split(/\s+/)[0] ?? '').toLowerCase()
  const rest = trimmed.slice(verb.length).trim()
  switch (verb) {
    case 'test': {
      if (!rest) return '用法：/sniffer test <一段文本>'
      const found = scan(rest, { allow })
      return found.length
        ? `会被拦截：\n${found.map(f => `  ${f.label} (${f.rule})：${f.masked}`).join('\n')}`
        : '不会被拦截。'
    }
    case 'allow': {
      if (!rest) return '用法：/sniffer allow <正则>，匹配到的文件路径或行会被放过。例：/sniffer allow tests/fixtures/'
      try {
        new RegExp(rest, 'i')
      } catch {
        return `正则写错了：${rest}`
      }
      allow = [...new Set([...allow, rest])]
      await $.store.set(STORE_ALLOW, allow)
      return `已放行：${rest}`
    }
    case 'unallow': {
      if (!allow.includes(rest)) return `放行列表里没有「${rest}」。`
      allow = allow.filter(a => a !== rest)
      await $.store.set(STORE_ALLOW, allow)
      return `已移除放行：${rest}`
    }
    case 'off':
      isOn = false
      await $.store.set(STORE_ON, false)
      $.ui.status(undefined)
      return '密钥嗅探已关闭。/sniffer on 重新开启。'
    case 'on':
      isOn = true
      await $.store.set(STORE_ON, true)
      return '密钥嗅探已开启。'
    default: {
      const s = await read($, sniffsAtom)
      return [
        `密钥嗅探${isOn ? '开启中' : '已关闭'} · 本次会话拦截 ${s.blocked} 次`,
        `规则：${DETECTORS.map(d => d.id).join('、')}`,
        allow.length ? `放行：${allow.join('  ')}` : '放行：（无）',
        ...s.recent.slice(0, 5).map(f => `  ${new Date(f.at).toTimeString().slice(0, 5)} ${f.label} · ${where(f)} · ${f.masked}`),
        '命令：/sniffer list | test <文本> | allow <正则> | unallow <正则> | on | off',
      ].join('\n')
    }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    allow = ((await $.store.get(STORE_ALLOW)) as string[] | undefined) ?? []
    isOn = (await $.store.get(STORE_ON)) !== false
    await $.command.register({
      name: 'sniffer',
      description: 'Secret Sniffer: /sniffer list | test <text> | allow <regex> | unallow <regex> | on | off',
      argumentHint: 'list | test <text> | allow <regex> | unallow <regex> | on | off',
    })
    return next(e)
  })

  on('command.run', { command: 'sniffer' }, async ($, e) => ({ text: await sniffer($, e.args) }))

  on('tool.call', async ($, e, next) => {
    if (!isOn) return next(e)
    const tool = String(e.tool)
    const isCommit = tool === 'Bash' && COMMIT_RE.test((e as unknown as { command: string }).command)
    const pieces = isCommit ? await stagedPieces($, (e as unknown as { command: string }).command) : piecesOf(tool, e)
    if (pieces.length > 0) {
      const findings = findAll(pieces)
      if (findings.length > 0) {
        await record($, findings)
        return { deny: denyText(findings, isCommit) }
      }
    }
    return next(e)
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: 'Secret Sniffer could not check this call, so it was refused. The user can run /sniffer off to skip the check.' },
  )
}
