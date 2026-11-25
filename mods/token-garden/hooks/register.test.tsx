import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { kindOfTurn } from './register'

const PANE = {
  plugin: 'token-garden',
  component: 'Pane',
  requestId: 'token-garden',
  props: {
    title: 'garden',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('a turn grows the kind it did most', () => {
  expect(kindOfTurn({})).toBe('sprout')
  expect(kindOfTurn({ grass: 5, flower: 2 })).toBe('grass')
  expect(kindOfTurn({ grass: 2, flower: 2 })).toBe('flower')
  expect(kindOfTurn({ tree: 1, mushroom: 1 })).toBe('mushroom')
})

function world(on: Parameters<TestBody>[1], pct: () => number, toasts: string[]) {
  mock.store(on)
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'garden' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.usage', () => ({
    value: { startedAt: 0, rateLimits: [], context: { percent: pct(), tokens: pct() * 1000, window: 100000 } },
  }))
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  on('turn.complete', () => ({ text: 'ok' }))
}

const TURN = { turnId: 't', answer: 'ok', isAborted: false, reason: 'answer', durationMs: 1000 } as const

test('turns plant, the garden wilts at 80% with one nudge, and a compaction replants', async ($, on) => {
  let pct = 20
  const toasts: string[] = []
  world(on, () => pct, toasts)
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [] }] }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/a.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Edit', file_path: '/a.ts', old_string: 'b', new_string: 'c' })
  await $.tool.call({ tool: 'Read', file_path: '/b.ts' })
  await $.turn.complete(TURN)
  await $.turn.complete(TURN)

  const first = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await first.find({ type: 'Text', text: /🌸/ }))?.text).toBe('🌸🌱')
  expect((await first.find({ type: 'Text', text: /^上下文/ }))?.text).toContain('20% · 茂盛')
  await first.unmount()

  pct = 85
  await $.turn.complete(TURN)
  await $.turn.complete(TURN)
  expect(toasts.filter(t => t.includes('/compact'))).toHaveLength(1)
  const dry = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await dry.find({ type: 'Text', text: /^上下文/ }))?.text).toContain('85% · 快枯了')
  await dry.unmount()

  pct = 30
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'a', toolUses: [] }] })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /刚翻过土/ }))?.text).toBe('（刚翻过土）')
  expect((await ui.find({ type: 'Text', text: /已重种/ }))?.text).toContain('已重种 1 次')
  await ui.unmount()
})
