// BRANCH WARDEN: keeps Claude's work off protected branches.
//  - Protected by default: main, master, trunk, develop, production, release/*.
//  - On one, the first file edit in the repository asks you (mode `ask`), is refused
//    (`block`), or only warns (`warn`). Saying yes once lets edits on that branch
//    through for the rest of the session.
//  - Every `git commit` on a protected branch is asked about the same way.
//  - The status line names the branch, and marks a protected one.
//  - /warden [status | allow | mode <ask|block|warn> | protect <branch> | unprotect <branch> | on | off]
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mode, Warden } from '../types'

const STORE_MODE = 'branch-warden.mode'
const STORE_EXTRA = 'branch-warden.protect'
const STORE_UNPROTECT = 'branch-warden.unprotect'
const STORE_ON = 'branch-warden.isOn'
const DEFAULT_PROTECTED = ['main', 'master', 'trunk', 'develop', 'production', 'release/*']
const FILE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])
const COMMIT_RE = /(^|[\s;&|(])git\s+(?:-C\s+\S+\s+)?commit\b/
const MOVES_RE = /(^|[\s;&|(])git\s+(?:-C\s+\S+\s+)?(?:checkout|switch|branch|worktree|rebase|merge|pull|stash)\b|(^|[\s;&|(])gh\s+pr\s+checkout\b/

const EMPTY: Warden = { root: '', branch: '', isProtected: false, allowed: [] }
const wardenAtom = atom({ plugin: 'branch-warden', key: 'warden' } as const, EMPTY, { shape: 'warden-1' })

// Settings, read at session.start (and so again after a reload).
let mode: Mode = 'ask'
let extra: string[] = []
let unprotected: string[] = []
let isOn = true

export function patternsOf(more: readonly string[], less: readonly string[]): string[] {
  return [...new Set([...DEFAULT_PROTECTED, ...more])].filter(p => !less.includes(p))
}

/** `release/*` matches `release/1.2`; anything else must match exactly. */
export function isProtectedName(branch: string, patterns: readonly string[]): boolean {
  if (!branch) return false
  return patterns.some(p => (p.endsWith('/*') ? branch.startsWith(p.slice(0, -1)) : p === branch))
}

const protectedNow = (branch: string) => isProtectedName(branch, patternsOf(extra, unprotected))

async function git($: EngineInterface, args: string[]): Promise<string | undefined> {
  try {
    const r = await $.process.run(['git', ...args], { timeoutMs: 4000 })
    return r.exitCode === 0 ? r.stdout.trim() : undefined
  } catch {
    return undefined
  }
}

function statusOf(w: Warden): string | undefined {
  if (!isOn) return undefined
  if (!w.root) return undefined
  if (!w.branch) return '⎇ (detached HEAD)'
  if (!w.isProtected) return `⎇ ${w.branch}`
  return w.allowed.includes(w.branch) ? `⎇ ${w.branch} · 已允许直接改` : `⎇ ${w.branch} ⚠ 受保护分支`
}

async function refresh($: EngineInterface): Promise<Warden> {
  const root = (await git($, ['rev-parse', '--show-toplevel'])) ?? ''
  const head = root ? ((await git($, ['rev-parse', '--abbrev-ref', 'HEAD'])) ?? '') : ''
  const branch = head === 'HEAD' ? '' : head
  const next = await update($, wardenAtom, w => ({ ...w, root, branch, isProtected: protectedNow(branch) }))
  $.ui.status(statusOf(next))
  return next
}

function suggestion(): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  return `git switch -c claude/${stamp}`
}

type Verdict = { kind: 'edit' | 'commit'; branch: string } | undefined

/** Whether this call touches a protected branch, read from the input. */
function judge(w: Warden, tool: string, input: unknown): Verdict {
  if (!isOn || !w.root || !w.isProtected) return undefined
  const i = (input ?? {}) as { file_path?: unknown; notebook_path?: unknown; command?: unknown }
  if (FILE_TOOLS.has(tool)) {
    if (w.allowed.includes(w.branch)) return undefined
    const path = typeof i.file_path === 'string' ? i.file_path : typeof i.notebook_path === 'string' ? i.notebook_path : ''
    return path.startsWith(`${w.root}/`) ? { kind: 'edit', branch: w.branch } : undefined
  }
  if (tool === 'Bash' && typeof i.command === 'string' && COMMIT_RE.test(i.command)) return { kind: 'commit', branch: w.branch }
  return undefined
}

const reasonOf = (v: NonNullable<Verdict>) =>
  v.kind === 'edit'
    ? `⎇ 分支守卫：你在受保护分支 ${v.branch} 上，Claude 要直接改文件。建议先开新分支：${suggestion()}。确认就在 ${v.branch} 上改（本次会话之后不再问）？`
    : `⎇ 分支守卫：要直接提交到受保护分支 ${v.branch}。确认提交？`

async function warden($: EngineInterface, args: string): Promise<string> {
  const [verb = 'status', arg = ''] = args.trim().split(/\s+/).filter(Boolean)
  const w = await read($, wardenAtom)
  switch (verb.toLowerCase()) {
    case 'allow': {
      if (!w.branch) return '当前不在任何分支上。'
      const next = await update($, wardenAtom, cur => ({ ...cur, allowed: [...new Set([...cur.allowed, cur.branch])] }))
      $.ui.status(statusOf(next))
      return `本次会话允许 Claude 在 ${w.branch} 上直接改文件（提交仍然会问）。`
    }
    case 'mode': {
      if (arg !== 'ask' && arg !== 'block' && arg !== 'warn') return '用法：/warden mode <ask|block|warn>'
      mode = arg
      await $.store.set(STORE_MODE, mode)
      return `模式改为 ${mode}：${{ ask: '先问你', block: '直接拒绝', warn: '只提醒' }[mode]}。`
    }
    case 'protect':
    case 'unprotect': {
      if (!arg) return `用法：/warden ${verb} <分支名，可用 release/* 这样的前缀>`
      if (verb === 'protect') {
        extra = [...new Set([...extra, arg])]
        unprotected = unprotected.filter(b => b !== arg)
      } else {
        extra = extra.filter(b => b !== arg)
        unprotected = [...new Set([...unprotected, arg])]
      }
      await $.store.set(STORE_EXTRA, extra)
      await $.store.set(STORE_UNPROTECT, unprotected)
      await refresh($)
      return `受保护分支：${patternsOf(extra, unprotected).join('、')}`
    }
    case 'off':
      isOn = false
      await $.store.set(STORE_ON, false)
      $.ui.status(undefined)
      return '分支守卫已关闭。/warden on 重新开启。'
    case 'on':
      isOn = true
      await $.store.set(STORE_ON, true)
      await refresh($)
      return '分支守卫已开启。'
    default: {
      const now = await refresh($)
      return [
        now.root ? `当前分支：${now.branch || '(detached HEAD)'}${now.isProtected ? '（受保护）' : ''}` : '当前目录不在 git 仓库里。',
        `模式：${mode}${isOn ? '' : '（已关闭）'} · 受保护：${patternsOf(extra, unprotected).join('、')}`,
        now.allowed.length ? `本次会话已允许：${now.allowed.join('、')}` : '',
        '命令：/warden status | allow | mode <ask|block|warn> | protect <分支> | unprotect <分支> | on | off',
      ]
        .filter(Boolean)
        .join('\n')
    }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const storedMode = await $.store.get(STORE_MODE)
    mode = storedMode === 'block' || storedMode === 'warn' ? storedMode : 'ask'
    extra = ((await $.store.get(STORE_EXTRA)) as string[] | undefined) ?? []
    unprotected = ((await $.store.get(STORE_UNPROTECT)) as string[] | undefined) ?? []
    isOn = (await $.store.get(STORE_ON)) !== false
    await $.command.register({
      name: 'warden',
      description: 'Branch Warden: /warden status | allow | mode <ask|block|warn> | protect <branch> | unprotect <branch> | on | off',
      argumentHint: 'status | allow | mode <ask|block|warn> | protect <branch> | unprotect <branch> | on | off',
    })
    await refresh($)
    return next(e)
  })

  on('command.run', { command: 'warden' }, async ($, e) => ({ text: await warden($, e.args) }))

  // block and warn are decided here; an edit that goes through on a protected
  // branch (you said yes) allows the branch for the rest of the session.
  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const w = await read($, wardenAtom)
    const v = judge(w, tool, e)
    if (v && mode === 'block') {
      $.ui.toast(`⎇ 已拦截：在受保护分支 ${v.branch} 上${v.kind === 'edit' ? '改文件' : '提交'}`, { timeoutMs: 7000 })
      return {
        deny: `Branch Warden: ${v.branch} is a protected branch, so ${v.kind === 'edit' ? 'editing files' : 'committing'} on it is blocked. Create a branch first (for example \`${suggestion()}\`), then continue there.`,
      }
    }
    if (v && mode === 'warn') $.ui.toast(`⎇ 注意：正在受保护分支 ${v.branch} 上${v.kind === 'edit' ? '改文件' : '提交'}`, { timeoutMs: 6000 })
    const ran = await next(e)
    const ok = ran.deny === undefined && ran.isError !== true
    if (ok && v?.kind === 'edit' && mode === 'ask') {
      const after = await update($, wardenAtom, cur => ({ ...cur, allowed: [...new Set([...cur.allowed, v.branch])] }))
      $.ui.status(statusOf(after))
    }
    if (tool === 'Bash' && MOVES_RE.test((e as unknown as { command: string }).command)) await refresh($)
    return ran
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'Branch Warden could not check this call, so it was refused.' }))

  // ask: put to you even where the mode or a rule would allow the call.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'deny' || mode !== 'ask') return verdict
    const v = judge(await read($, wardenAtom), e.tool, e.input)
    return v ? { decision: 'ask', reason: reasonOf(v) } : verdict
  }).catch(() => ({ decision: 'ask', reason: '⎇ 分支守卫没能检查这次调用，请人工确认。' }))
}
