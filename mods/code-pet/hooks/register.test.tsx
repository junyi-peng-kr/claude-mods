import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'code-pet',
  component: 'Pane',
  requestId: 'code-pet',
  props: {
    title: 'pet',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('a passing test run feeds the pet, on every surface', async ($, on) => {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {}, text: 'Tests: 12 passed, 12 total' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /🍎 1/ }))?.text).toContain('🍎 1')
    expect((await ui.find({ type: 'Text', text: /^饱食/ }))?.text).toContain('100')
    await ui.unmount()
  }
})

test('a failing test run upsets it', async ($, on) => {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {}, text: 'Tests: 2 failed, 10 passed', isError: true }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npx vitest run' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /🩹 1/ }))?.text).toContain('🩹 1')
  expect((await ui.find({ type: 'Text', text: /^心情/ }))?.text).toContain('62')
  await ui.unmount()
})
