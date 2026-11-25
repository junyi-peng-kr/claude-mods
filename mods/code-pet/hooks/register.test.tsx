import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

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

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

function world(on: Parameters<TestBody>[1]) {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

test('/pet adopt turns the pet into a named tricolor corgi and keeps its XP', async ($, on) => {
  world(on)
  on('tool.call', () => ({ result: {}, text: '3 passed' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  const r = await $.command.run({ ...RUN, command: 'pet', args: 'adopt corgi tricolor Ace' })
  expect(r.text).toContain('三色柯基「Ace」')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^Ace · / }))?.text).toContain('Ace · 三色柯基 · ')
    expect((await ui.find({ type: 'Text', text: /^XP/ }))?.text).toContain('XP 1')
    await ui.unmount()
  }
})

test('the panel pickers change the kind and the coat', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'species', value: 'cat' })
  await ui.unmount()
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'coat', value: 'calico' })
  await ui.input({ key: 'name', text: '年糕' })
  await ui.unmount()
  const shown = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await shown.find({ type: 'Text', text: /^年糕 · / }))?.text).toContain('三花猫')
  await shown.unmount()
})

test('the settings can pin the kind, coat and name', { options: { species: 'bunny', coat: 'brown', name: 'Mochi' } }, async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^Mochi · / }))?.text).toContain('棕兔')
  await ui.unmount()
})
