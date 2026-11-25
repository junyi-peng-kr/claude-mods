import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'boss-fight',
  component: 'Pane',
  requestId: 'boss-fight',
  props: {
    title: 'boss',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('failures summon a boss, fewer failures hit it, a green run defeats it', async ($, on) => {
  mock.store(on)
  const outputs = [
    'FAIL src/auth.test.ts\n  ● auth › rejects expired token\nTests:       4 failed, 8 passed, 12 total',
    'Tests:       1 failed, 11 passed, 12 total',
    'Tests:       12 passed, 12 total',
  ]
  let i = 0
  const combats: unknown[] = []
  on('state.set', ($, e, next) => {
    if (e.plugin === 'boss-fight' && e.key === 'combat') combats.push(e.value)
    return next(e)
  })
  on('command.register', () => ({ value: { command: 'boss' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => {
    const text = outputs[i++] ?? ''
    return /failed/.test(text) ? { result: {}, text, isError: true } : { result: {}, text }
  })
  on('ui.toast', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /HP [█░]/ }))?.text).toContain('4/4')
  expect((await ui.find({ type: 'Text', text: /「auth › rejects expired token」/ }))?.text).toContain('精英')
  await ui.unmount()
  expect(combats.at(-1)).toMatchObject({ status: 'fighting', event: 'spawn', hp: 4 })

  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /造成/ }))?.text).toContain('造成 3 点伤害')
  await ui.unmount()

  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const end = await $.ui.mount({ ...PANE, surface })
    expect((await end.find({ type: 'Text', text: /战绩/ }))?.text).toContain('击败 1')
    expect((await end.find({ type: 'Text', text: /已击败/ }))?.text).toContain('3 回合')
    await end.unmount()
  }
  expect(combats.at(-1)).toMatchObject({ status: 'won', event: 'win', hp: 0, seq: 3 })
})

test('with NEON PILOT on, the fight is worded as KX-07 combat', async ($, on) => {
  mock.store(on)
  on('state.get', ($, e, next) =>
    e.plugin === 'neon-pilot' && e.key === 'isOn' ? { value: { value: true, version: 1 } } : next(e),
  )
  const toasts: string[] = []
  on('command.register', () => ({ value: { command: 'boss' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {}, text: '2 failed, 3 passed', isError: true }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'pytest' })
  expect(toasts.join('|')).toContain('ENEMY CONTACT')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /HP [█░]/ }))?.text).toContain('⚠ ENEMY CONTACT')
  await ui.unmount()
})

test('a passing run with no boss summons nothing', async ($, on) => {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'boss' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {}, text: '10 passed in 0.4s' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'pytest' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /没有 Boss/ }))?.text).toContain('一片和平')
  await ui.unmount()
})
