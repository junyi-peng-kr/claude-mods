// STANDUP SCRIBE: a daily log of what got done, per repository, for the standup.
//  - Records commits (subject read back with git log -1), PRs opened, files
//    edited, test runs and the first line of each prompt you send.
//  - Kept in the mod's store for the last 14 days, across sessions and projects.
//  - /scribe prints 昨天 / 今天 / 阻塞; /scribe md also writes it to
//    ~/.claude/standups/<date>.md; /scribe clear empties the log.
//    (Not /standup: the engineering plugin owns that name.)
//  - The standup_log tool hands Claude the raw log, so it can write the standup itself.
import type { EngineInterface, Register } from 'claude-code'

import type { Entry, Log } from './log'
import { dayOf, prune, record, slice, standupOf } from './log'

const STORE_LOG = 'standup-scribe.log'
const TOOL = 'standup_log'
const TOOL_FULL = 'mcp__standup-scribe__standup_log'
const FILE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])

const TEST_RE =
  /(^|[\s;&|(])((npm|pnpm|yarn|bun)\s+(run\s+)?test\b|npx\s+(jest|vitest|mocha|playwright)\b|(jest|vitest|pytest|mocha|rspec|phpunit)\b|go\s+test\b|cargo\s+(test|nextest)\b|python3?\s+-m\s+(pytest|unittest)\b|make\s+test\b|deno\s+test\b|swift\s+test\b|mvn\s+test\b|gradle\w*\s+test\b)/
const FAIL_RE = /\b[1-9]\d*\s+(failed|failing|failures?)\b|\bFAIL(ED)?\b|Tests?:\s+[1-9]\d*\s+failed/
const COMMIT_RE = /(^|[\s;&|(])git\s+(?:-C\s+\S+\s+)?commit\b/
const PR_URL_RE = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/

// The repository of the session's folder, asked of git once.
let repoCache: { root: string; name: string } | undefined

async function git($: EngineInterface, args: string[]): Promise<string | undefined> {
  try {
    const r = await $.process.run(['git', ...args], { timeoutMs: 4000 })
    return r.exitCode === 0 ? r.stdout.trim() : undefined
  } catch {
    return undefined
  }
}

async function repoOf($: EngineInterface): Promise<{ root: string; name: string }> {
  if (repoCache) return repoCache
  const cwd = await $.session.cwd()
  const root = (await git($, ['rev-parse', '--show-toplevel'])) ?? ''
  const name = (root || cwd).split('/').filter(Boolean).pop() ?? 'session'
  repoCache = { root, name }
  return repoCache
}

async function loadLog($: EngineInterface): Promise<Log> {
  return ((await $.store.get(STORE_LOG)) as Log | undefined) ?? {}
}

// Writes go one at a time, so parallel tool calls don't drop each other's entries.
let writes: Promise<void> = Promise.resolve()

async function add($: EngineInterface, entry: Entry) {
  const at = Date.now()
  const write = writes.then(async () => {
    const { name } = await repoOf($)
    const log = await loadLog($)
    await $.store.set(STORE_LOG, record(log, name, at, entry))
  })
  writes = write.catch(() => undefined)
  await write
}

async function writeMarkdown($: EngineInterface, markdown: string, today: string): Promise<string> {
  const home = (await $.env.get('HOME')) ?? (await $.session.cwd())
  const path = `${home}/.claude/standups/${today}.md`
  await $.fs.write(path, markdown)
  return path
}

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    repoCache = undefined
    await $.command.register({
      name: 'scribe',
      description: 'Standup from the daily log: /scribe | /scribe md | /scribe clear',
      argumentHint: 'md | clear',
    })
    await $.tool.register({
      name: TOOL,
      description:
        "The user's recorded coding activity per local day and repository, for writing a standup or a daily summary: commits (sha, subject), PRs opened, files edited, test runs (pass or fail) and the first line of each prompt they sent. Covers the last 14 days. Call it when the user asks what they did, for a standup, or for a recap of a day; leave out `from` and `to` for the last two active days.",
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'First day, YYYY-MM-DD (local time).' },
          to: { type: 'string', description: 'Last day, YYYY-MM-DD (local time). Defaults to today.' },
          repo: { type: 'string', description: 'Only this repository (its folder name).' },
        },
      },
      isDeferred: false,
    })
    // Prune once a session, so an idle log still ages out.
    const log = await loadLog($)
    await $.store.set(STORE_LOG, prune(log, Date.now()))
    return next(e)
  })

  on('command.run', { command: 'scribe' }, async ($, e) => {
    const verb = e.args.trim().toLowerCase()
    if (verb === 'clear') {
      await $.store.set(STORE_LOG, {})
      return { text: '站会记录已清空。' }
    }
    const s = standupOf(await loadLog($), Date.now())
    if (verb === 'md') {
      const path = await writeMarkdown($, s.markdown, s.today)
      return { text: `${s.text}\n\n已写入 ${path}` }
    }
    return { text: s.text }
  })

  on('tool.run', { tool: TOOL_FULL }, async ($, e) => {
    const input = e as unknown as { from?: unknown; to?: unknown; repo?: unknown; input?: Record<string, unknown> }
    const args = input.input ?? input
    const log = await loadLog($)
    const now = Date.now()
    const today = dayOf(now)
    const to = isDate(args.to) ? args.to : today
    let from = isDate(args.from) ? args.from : undefined
    if (!from) {
      const active = Object.keys(log).filter(d => d <= to).sort()
      from = active.length >= 2 ? active[active.length - 2]! : (active[0] ?? to)
    }
    const repo = typeof args.repo === 'string' && args.repo ? args.repo : undefined
    const data = slice(log, from, to, repo)
    return {
      result: JSON.stringify({ today, from, to, ...(repo ? { repo } : {}), days: data }, null, 1),
    }
  }).catch(() => ({ deny: 'standup_log could not read the log.' }))

  on('prompt.submit', async ($, e, next) => {
    // Only what a person typed: not task notifications, scheduled prompts or other sessions' messages.
    const isPerson = e.origin.kind === 'composer' || e.origin.kind === 'bridge' || e.origin.kind === 'sdk'
    if (isPerson && !e.isMeta && !e.command) {
      const first = e.text.split('\n').find(l => l.trim())?.trim() ?? ''
      if (first) await add($, { kind: 'prompt', text: first.slice(0, 120) })
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran
    const tool = String(e.tool)
    const isOk = ran.isError !== true
    if (FILE_TOOLS.has(tool) && isOk) {
      const i = e as unknown as { file_path?: unknown; notebook_path?: unknown }
      const abs = typeof i.file_path === 'string' ? i.file_path : typeof i.notebook_path === 'string' ? i.notebook_path : ''
      if (abs) {
        // Files outside the repository aren't this repository's work.
        const { root } = await repoOf($)
        if (root && abs.startsWith(`${root}/`)) await add($, { kind: 'edit', path: abs.slice(root.length + 1) })
      }
      return ran
    }
    const text = ran.text ?? ''
    if (tool === 'Bash') {
      const cmd = (e as unknown as { command: string }).command
      if (TEST_RE.test(cmd)) {
        const failed = Number(text.match(/(\d+)\s+(?:failed|failing)/i)?.[1] ?? 0)
        const passed = isOk && !FAIL_RE.test(text)
        await add($, {
          kind: 'test',
          run: { at: Date.now(), isOk: passed, command: cmd.replace(/\s+/g, ' ').trim().slice(0, 80), ...(failed ? { failed } : {}) },
        })
      }
      if (isOk && COMMIT_RE.test(cmd)) {
        const head = await git($, ['log', '-1', '--format=%h%x09%s'])
        if (head) {
          const [sha = '', ...rest] = head.split('\t')
          await add($, { kind: 'commit', commit: { sha, subject: rest.join('\t'), at: Date.now() } })
        }
      }
    }
    const url = isOk ? text.match(PR_URL_RE)?.[0] : undefined
    const isPrTool =
      tool === 'Bash' ? /\bgh\s+pr\s+create\b/.test((e as unknown as { command: string }).command) : /create_pull_request|pr_create|create_pr/i.test(tool)
    if (url && isPrTool) {
      await add($, { kind: 'pr', url })
    }
    return ran
  }).catch(($, e, next) => next(e))
}
