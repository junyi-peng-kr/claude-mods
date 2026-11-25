import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { isProtectedName, patternsOf } from './register'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

test('which branches are protected', () => {
  const p = patternsOf(['staging'], ['develop'])
  expect(isProtectedName('main', p)).toBe(true)
  expect(isProtectedName('release/1.4', p)).toBe(true)
  expect(isProtectedName('staging', p)).toBe(true)
  expect(isProtectedName('develop', p)).toBe(false)
  expect(isProtectedName('feat/main-menu', p)).toBe(false)
  expect(isProtectedName('', p)).toBe(false)
})

function world(on: Parameters<TestBody>[1], branch: () => string) {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'warden' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('process.run', (_, e) => {
    const a = e.argv.join(' ')
    const stdout = a.includes('--show-toplevel') ? '/repo\n' : a.includes('--abbrev-ref') ? `${branch()}\n` : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.check', () => ({ decision: 'allow' }))
  on('tool.call', () => ({ result: {}, text: 'ok' }))
}

test('on main, an edit and a commit are asked about; on a feature branch nothing is', async ($, on) => {
  let branch = 'main'
  world(on, () => branch)
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })

  const edit = await $.tool.check({ tool: 'Edit', input: { file_path: '/repo/src/a.ts' } })
  expect(edit.decision).toBe('ask')
  expect(edit.reason).toContain('git switch -c claude/')
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git commit -m x' } })).decision).toBe('ask')
  expect((await $.tool.check({ tool: 'Edit', input: { file_path: '/tmp/scratch.ts' } })).decision).toBe('allow')
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git status' } })).decision).toBe('allow')

  // Allowing the branch lets edits through for the session; commits still ask.
  // (Saying yes to the first edit does the same; a test can't answer an ask.)
  expect((await $.command.run({ ...RUN, command: 'warden', args: 'allow' })).text).toContain('main')
  expect((await $.tool.check({ tool: 'Edit', input: { file_path: '/repo/src/b.ts' } })).decision).toBe('allow')
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git commit -am y' } })).decision).toBe('ask')

  branch = 'feat/login'
  await $.tool.call({ tool: 'Bash', command: 'git switch -c feat/login' })
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git commit -m x' } })).decision).toBe('allow')
})

test('block mode refuses an edit on main', async ($, on) => {
  world(on, () => 'master')
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  const set = await $.command.run({ ...RUN, command: 'warden', args: 'mode block' })
  expect(set.text).toContain('block')
  const r = await $.tool.call({ tool: 'Write', file_path: '/repo/x.md', content: 'hi' })
  expect(r.deny).toContain('protected branch')
})
