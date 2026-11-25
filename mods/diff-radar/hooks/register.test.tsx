import { expect, mock, test } from 'claude-code/testing'

import { parseNumstat } from './register'

const PANE = {
  plugin: 'diff-radar',
  component: 'Pane',
  requestId: 'diff-radar',
  props: {
    title: 'radar',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('numstat rows, renames and binaries are read', () => {
  expect(parseNumstat('12\t3\tsrc/a.ts\n-\t-\tlogo.png\n4\t0\tsrc/{old => new}/b.ts\n1\t1\tx.md => y.md\n')).toEqual([
    { path: 'src/a.ts', add: 12, del: 3 },
    { path: 'logo.png', add: 0, del: 0 },
    { path: 'src/new/b.ts', add: 4, del: 0 },
    { path: 'y.md', add: 1, del: 1 },
  ])
})

test('changed files show, and the fifth edit of one file is a churn warning', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on)
  const toasts: string[] = []
  on('command.register', () => ({ value: { command: 'radar' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('process.run', (_, e) => {
    const a = e.argv.join(' ')
    const stdout = a.includes('--show-toplevel')
      ? '/repo\n'
      : a.includes('--abbrev-ref')
        ? 'feat/login\n'
        : a.includes('diff --numstat')
          ? '30\t4\tsrc/auth.ts\n2\t2\tREADME.md\n'
          : a.includes('ls-files')
            ? 'src/new.ts\n'
            : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.read', () => ({ value: 'a\nb\nc\n' }))
  on('tool.call', () => ({ result: {}, text: 'ok' }))

  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
  for (let i = 0; i < 5; i += 1) await $.tool.call({ tool: 'Edit', file_path: '/repo/src/auth.ts', old_string: 'a', new_string: 'b' })
  await clock.advance(2000)

  expect(toasts.join('|')).toContain('auth.ts 已经被改了 5 次')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /src\/auth\.ts/ }))?.text).toContain('+30 −4 · 改 5 次')
    expect((await ui.find({ type: 'Text', text: /src\/new\.ts/ }))?.text).toContain('(新) +3 −0')
    expect((await ui.find({ type: 'Text', text: /反复修改/ }))?.text).toContain('auth.ts ×5')
    await ui.unmount()
  }
})
