import { expect, mock, test } from 'claude-code/testing'

import { shichenOf, solarTermOf, statusOf } from './paper'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

test('solar terms by date, the year wrapping through 冬至', () => {
  expect(solarTermOf(new Date(2026, 10, 24))).toBe('小雪')
  expect(solarTermOf(new Date(2026, 11, 21))).toBe('冬至')
  expect(solarTermOf(new Date(2026, 0, 1))).toBe('冬至')
  expect(solarTermOf(new Date(2026, 0, 6))).toBe('小寒')
  expect(solarTermOf(new Date(2026, 1, 4))).toBe('立春')
  expect(solarTermOf(new Date(2026, 5, 21))).toBe('夏至')
  expect(solarTermOf(new Date(2026, 8, 22))).toBe('白露')
})

test('double hours', () => {
  expect(shichenOf(new Date(2026, 0, 1, 23, 30))).toBe('子时')
  expect(shichenOf(new Date(2026, 0, 1, 0, 30))).toBe('子时')
  expect(shichenOf(new Date(2026, 0, 1, 1, 0))).toBe('丑时')
  expect(shichenOf(new Date(2026, 0, 1, 12, 0))).toBe('午时')
  expect(shichenOf(new Date(2026, 0, 1, 13, 30))).toBe('未时')
  expect(shichenOf(new Date(2026, 0, 1, 22, 59))).toBe('亥时')
  expect(statusOf(new Date(2026, 10, 24, 13, 30))).toBe('🖌 小雪 · 未时')
})

test('the look is set with its scene, a passing test stamps 「准」, and /ink off clears it', async ($, on) => {
  mock.store(on)
  const scenes: string[] = []
  const toasts: string[] = []
  let cleared = 0
  on('command.register', () => ({ value: { command: 'ink' } }))
  on('theme.set', (_, e) => {
    const backdrop = e.backdrop as { scene?: string } | undefined
    if (backdrop?.scene) scenes.push(backdrop.scene)
    return { value: { isDrawn: true, requestId: 'look' } }
  })
  on('theme.clear', () => {
    cleared += 1
    return { value: { isDrawn: true, requestId: 'clear' } }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', (_, e) =>
    e.tool === 'Bash' && e.command === 'pytest -x' ? { result: {}, text: '2 failed, 8 passed', isError: true } : { result: {}, text: '10 passed in 0.3s' },
  )

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(scenes).toEqual(['ink-wash'])

  await $.tool.call({ tool: 'Bash', command: 'pytest -x' })
  expect(toasts).toEqual([])
  await $.tool.call({ tool: 'Bash', command: 'pytest' })
  expect(toasts.join('|')).toContain('「准」')

  const off = await $.command.run({ ...RUN, command: 'ink', args: 'off' })
  expect(off.text).toContain('/ink on')
  expect(cleared).toBe(1)
  await $.tool.call({ tool: 'Bash', command: 'pytest' })
  expect(toasts.length).toBe(1)
})
