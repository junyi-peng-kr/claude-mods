import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'flight-recorder',
  component: 'Pane',
  requestId: 'flight-recorder',
  props: {
    title: 'rec',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('a turn and its tool calls are recorded, failures marked', async ($, on) => {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'recorder' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', (_, e) =>
    e.tool === 'Bash' && e.command === 'npm test' ? { result: {}, text: 'fail', isError: true } : { result: {}, text: 'ok' },
  )

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Read', file_path: '/repo/src/auth.ts' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /次调用 · \d+ 次失败/ }))?.text).toContain('2 次调用 · 1 次失败')
    expect((await ui.find({ type: 'Text', text: /^#1 · Bash/ }))?.text).toContain('npm test')
    await ui.unmount()
  }
})
