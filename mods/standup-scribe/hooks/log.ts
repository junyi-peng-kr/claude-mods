// The activity log and the standup built from it. No `$` here.

export type Commit = { sha: string; subject: string; at: number }
export type TestRun = { at: number; isOk: boolean; command: string; failed?: number }
export type Edit = { path: string; at: number }
export type Pr = { url: string; at: number }
export type Prompt = { text: string; at: number }

export type RepoDay = {
  commits: Commit[]
  edits: Edit[]
  tests: TestRun[]
  prs: Pr[]
  prompts: Prompt[]
  firstAt: number
  lastAt: number
}

/** Keyed by local date (YYYY-MM-DD), then by repository name. */
export type Log = Record<string, Record<string, RepoDay>>

export const KEEP_DAYS = 14

export const dayOf = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const emptyDay = (at: number): RepoDay => ({ commits: [], edits: [], tests: [], prs: [], prompts: [], firstAt: at, lastAt: at })

export type Entry =
  | { kind: 'commit'; commit: Commit }
  | { kind: 'edit'; path: string }
  | { kind: 'test'; run: TestRun }
  | { kind: 'pr'; url: string }
  | { kind: 'prompt'; text: string }

/** Adds one entry to the day of `at`, keeping each list bounded and the log to the last 14 days. */
export function record(log: Log, repo: string, at: number, entry: Entry): Log {
  const day = dayOf(at)
  const cur = log[day]?.[repo] ?? emptyDay(at)
  const next: RepoDay = { ...cur, lastAt: at }
  switch (entry.kind) {
    case 'commit':
      if (!cur.commits.some(c => c.sha === entry.commit.sha)) next.commits = [...cur.commits, entry.commit].slice(-50)
      break
    case 'edit':
      next.edits = [...cur.edits.filter(e => e.path !== entry.path), { path: entry.path, at }].slice(-150)
      break
    case 'test':
      next.tests = [...cur.tests, entry.run].slice(-60)
      break
    case 'pr':
      if (!cur.prs.some(p => p.url === entry.url)) next.prs = [...cur.prs, { url: entry.url, at }].slice(-20)
      break
    case 'prompt':
      next.prompts = [...cur.prompts, { text: entry.text, at }].slice(-30)
      break
  }
  const merged: Log = { ...log, [day]: { ...(log[day] ?? {}), [repo]: next } }
  return prune(merged, at)
}

export function prune(log: Log, now: number): Log {
  const cutoff = dayOf(now - (KEEP_DAYS - 1) * 86_400_000)
  return Object.fromEntries(Object.entries(log).filter(([day]) => day >= cutoff))
}

/** The last earlier day with any activity, or undefined. */
export function previousDay(log: Log, today: string): string | undefined {
  return Object.keys(log)
    .filter(d => d < today && Object.keys(log[d] ?? {}).length > 0)
    .sort()
    .pop()
}

const base = (p: string) => p.split('/').filter(Boolean).pop() ?? p
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** What one repository did on one day, as short lines. */
export function dayLines(rd: RepoDay): string[] {
  const lines: string[] = []
  for (const c of rd.commits.slice(0, 8)) lines.push(`提交 ${c.sha}：${clip(c.subject, 70)}`)
  if (rd.commits.length > 8) lines.push(`……另有 ${rd.commits.length - 8} 次提交`)
  for (const p of rd.prs) lines.push(`开了 PR：${p.url}`)
  if (rd.commits.length === 0 && rd.prompts.length > 0) {
    for (const p of rd.prompts.slice(-3)) lines.push(`在做：${clip(p.text, 70)}`)
  }
  if (rd.edits.length > 0) {
    const names = [...new Set(rd.edits.slice(-6).reverse().map(e => base(e.path)))].join('、')
    lines.push(`改了 ${rd.edits.length} 个文件（${names}${rd.edits.length > 6 ? ' 等' : ''}）`)
  }
  if (rd.tests.length > 0) {
    const ok = rd.tests.filter(t => t.isOk).length
    const last = rd.tests[rd.tests.length - 1]!
    lines.push(`跑了 ${rd.tests.length} 次测试，${ok} 次通过，最后一次${last.isOk ? '通过' : '失败'}`)
  }
  return lines
}

/** What a day left open: tests still failing at its end, edits made after its last commit. */
export function blockerLines(rd: RepoDay, isToday: boolean): string[] {
  const out: string[] = []
  const last = rd.tests[rd.tests.length - 1]
  if (last && !last.isOk) {
    out.push(`测试还没通过：${clip(last.command, 50)}${last.failed ? `（${last.failed} 个失败）` : ''}，最后一次在 ${hhmm(last.at)}`)
  }
  const lastCommit = rd.commits[rd.commits.length - 1]?.at ?? 0
  const loose = rd.edits.filter(e => e.at > lastCommit)
  if (!isToday && loose.length > 0) out.push(`有 ${loose.length} 个文件改了还没提交（${loose.slice(-3).map(e => base(e.path)).join('、')}）`)
  return out
}

export type Standup = { today: string; yesterday?: string; text: string; markdown: string }

export function standupOf(log: Log, now: number): Standup {
  const today = dayOf(now)
  const yesterday = previousDay(log, today)
  const section = (day: string | undefined, fallback: string) => {
    const repos = day ? Object.entries(log[day] ?? {}) : []
    if (repos.length === 0) return { text: [`  ${fallback}`], md: [`- ${fallback}`] }
    const text: string[] = []
    const md: string[] = []
    for (const [repo, rd] of repos.sort((a, b) => b[1].lastAt - a[1].lastAt)) {
      const lines = dayLines(rd)
      if (lines.length === 0) continue
      text.push(`  [${repo}]`, ...lines.map(l => `    · ${l}`))
      md.push(`- **${repo}**`, ...lines.map(l => `  - ${l}`))
    }
    return text.length ? { text, md } : { text: [`  ${fallback}`], md: [`- ${fallback}`] }
  }
  const y = section(yesterday, '没有记录')
  const t = section(today, '还没有动静')
  const blocks: Array<[string, string]> = []
  for (const [day, isToday] of [
    [yesterday, false],
    [today, true],
  ] as const) {
    if (!day) continue
    for (const [repo, rd] of Object.entries(log[day] ?? {})) {
      // Yesterday's failing tests count only if today's runs haven't passed since.
      const todayRuns = log[today]?.[repo]?.tests ?? []
      for (const line of blockerLines(rd, isToday)) {
        if (!isToday && line.startsWith('测试') && todayRuns.some(r => r.isOk)) continue
        if (!isToday && line.includes('还没提交') && (log[today]?.[repo]?.commits.length ?? 0) > 0) continue
        blocks.push([repo, line])
      }
    }
  }
  const bText = blocks.length ? blocks.map(([r, l]) => `  · [${r}] ${l}`) : ['  无']
  const bMd = blocks.length ? blocks.map(([r, l]) => `- **${r}**：${l}`) : ['- 无']
  const yLabel = yesterday ? `昨天（${yesterday.slice(5)}）` : '昨天'
  const text = [`📋 站会 · ${today}`, yLabel, ...y.text, '今天', ...t.text, '阻塞', ...bText].join('\n')
  const markdown = [`# 站会 · ${today}`, '', `## ${yLabel}`, '', ...y.md, '', '## 今天', '', ...t.md, '', '## 阻塞', '', ...bMd, ''].join('\n')
  return { today, ...(yesterday ? { yesterday } : {}), text, markdown }
}

/** The days between `from` and `to` (inclusive), optionally one repository's. */
export function slice(log: Log, from: string, to: string, repo?: string): Log {
  return Object.fromEntries(
    Object.entries(log)
      .filter(([d]) => d >= from && d <= to)
      .map(([d, repos]) => [d, repo ? Object.fromEntries(Object.entries(repos).filter(([r]) => r === repo)) : repos]),
  )
}
