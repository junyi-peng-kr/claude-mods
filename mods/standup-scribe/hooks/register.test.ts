import { expect, mock, test } from 'claude-code/testing'

import { dayOf, record, standupOf } from './log'
import type { Log } from './log'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
const DAY = 86_400_000

test('yesterday is the last active day; blockers are failing tests and loose edits', () => {
  const now = new Date(2026, 10, 24, 10, 0).getTime()
  const twoDaysAgo = now - 2 * DAY
  let log: Log = {}
  log = record(log, 'api', twoDaysAgo, { kind: 'commit', commit: { sha: 'a1b2c3d', subject: 'Add login rate limit', at: twoDaysAgo } })
  log = record(log, 'api', twoDaysAgo + 60_000, { kind: 'edit', path: 'src/auth.ts' })
  log = record(log, 'api', twoDaysAgo + 120_000, { kind: 'test', run: { at: twoDaysAgo + 120_000, isOk: false, command: 'npm test', failed: 2 } })
  log = record(log, 'web', now, { kind: 'prompt', text: '修一下首页的样式' })
  log = record(log, 'old', now - 20 * DAY, { kind: 'prompt', text: 'ancient' })

  const s = standupOf(log, now)
  expect(s.yesterday).toBe(dayOf(twoDaysAgo))
  expect(s.text).toContain('提交 a1b2c3d：Add login rate limit')
  expect(s.text).toContain('在做：修一下首页的样式')
  expect(s.text).toContain('[api] 测试还没通过：npm test（2 个失败）')
  expect(s.text).toContain('[api] 有 1 个文件改了还没提交（auth.ts）')
  expect(s.text).not.toContain('ancient')
  expect(s.markdown).toContain('## 阻塞')
})

test('commits, tests and prompts are logged and served by /scribe and the tool', async ($, on) => {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'scribe' } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__standup-scribe__${e.name}` } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('session.cwd', () => ({ value: '/work/api' }))
  on('process.run', (_, e) => {
    const a = e.argv.join(' ')
    const stdout = a.includes('--show-toplevel') ? '/work/api\n' : a.includes('log -1') ? 'f00ba12\tFix token refresh\n' : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', ($, e, next) => {
    if (String(e.tool).startsWith('mcp__')) return next(e)
    if (e.tool === 'Bash' && e.command.includes('pr create')) return { result: {}, text: 'https://github.com/o/api/pull/42\n' }
    if (e.tool === 'Bash' && e.command.includes('test')) return { result: {}, text: 'Tests: 3 failed, 9 passed', isError: true }
    return { result: {}, text: 'ok' }
  })

  await $.session.start({ cwd: '/work/api', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'token 刷新有 bug\n细节如下……', wait: false, origin: RUN.origin })
  await $.prompt.submit({ text: '<task-notification> done', wait: false, origin: { kind: 'task-notification' } })
  await $.tool.call({ tool: 'Edit', file_path: '/work/api/src/token.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Edit', file_path: '/tmp/scratch/notes.md', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await $.tool.call({ tool: 'Bash', command: 'git commit -am "Fix token refresh"' })
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill' })

  const s = await $.command.run({ ...RUN, command: 'scribe', args: '' })
  expect(s.text).toContain('[api]')
  expect(s.text).toContain('提交 f00ba12：Fix token refresh')
  expect(s.text).toContain('开了 PR：https://github.com/o/api/pull/42')
  expect(s.text).toContain('测试还没通过：npm test（3 个失败）')

  const served = await $.tool.call({ tool: 'mcp__standup-scribe__standup_log' })
  const data = JSON.parse(String(served.result)) as { days: Log }
  const today = Object.values(data.days)[0]?.api
  // Only what a person typed, and only files inside the repository.
  expect(today?.prompts.map(p => p.text)).toEqual(['token 刷新有 bug'])
  expect(today?.edits.map(x => x.path)).toEqual(['src/token.ts'])
})
