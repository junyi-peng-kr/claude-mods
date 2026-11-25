import { expect, mock, test } from 'claude-code/testing'

import type { Combat } from '../types'

const PANE = {
  plugin: 'neon-pilot',
  component: 'Pane',
  requestId: 'neon-cockpit',
  props: {
    title: 'cockpit',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const fight = (seq: number, over: Partial<Combat>): Combat => ({
  status: 'fighting',
  event: 'spawn',
  seq,
  kind: '骷髅骑士',
  name: 'auth › login',
  tier: 'elite',
  hp: 4,
  maxHp: 4,
  rounds: 1,
  ...over,
})

test("boss-fight's contact and kill flash once each, and the lock-on shows while engaged", async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on)
  let combat: Combat | undefined = fight(1, { status: 'won', event: 'win', hp: 0 })
  on('state.get', ($, e, next) =>
    e.plugin === 'boss-fight' ? { value: { value: combat, version: combat ? combat.seq : 0 } } : next(e),
  )
  on('command.register', () => ({ value: { command: 'neon' } }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'look' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('session.usage', () => ({ value: { context: { percent: 12, tokens: 1200, window: 10000 }, startedAt: 0, rateLimits: [] } }))
  on('session.turns', () => ({ value: 0 }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.messages', () => ({ value: [] }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  // A fight that ended before the session is not announced.
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /TARGET DOWN/ })).toBeUndefined()
  await ui.unmount()

  combat = fight(2, {})
  await clock.advance(5000)
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /ENEMY CONTACT/ }))?.text).toContain('骷髅骑士')
  await ui.unmount()

  // Once the alert is gone, the lock-on line stays while the fight runs.
  combat = fight(3, { event: 'hit', hp: 1, rounds: 2 })
  await clock.advance(7000)
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /ENEMY LOCK/ }))?.text).toContain('HP 1/4')
  await ui.unmount()

  combat = fight(4, { status: 'won', event: 'win', hp: 0, rounds: 3 })
  await clock.advance(5000)
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /TARGET DOWN/ }))?.text).toContain('3 回合')
  await ui.unmount()
})
