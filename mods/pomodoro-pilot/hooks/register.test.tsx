import { expect, mock, test } from 'claude-code/testing'

const ORIGIN = { kind: 'composer' } as const
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
const T0 = new Date(2026, 10, 24, 9, 0, 0).getTime()
const MIN = 60_000

const PANE = {
  plugin: 'pomodoro-pilot',
  component: 'Pane',
  requestId: 'pomodoro-pilot',
  props: {
    title: 'pomo',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('focus counts down, ends into a break, and the break holds a long task until it ends', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: T0 })
  const toasts: string[] = []
  const statuses: Array<string | undefined> = []
  on('command.register', () => ({ value: { command: 'pomo' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: 'ok' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const started = await $.command.run({ ...RUN, command: 'pomo', args: 'start' })
  expect(started.text).toContain('25')
  expect(statuses.at(-1)).toBe('🍅 25:00 专注中')

  await clock.advance(10 * MIN)
  expect(statuses.at(-1)).toBe('🍅 15:00 专注中')

  await clock.advance(15 * MIN)
  expect(toasts.join('|')).toContain('今天第 1 个')
  expect(statuses.at(-1)).toBe('☕ 05:00 休息中 · 今日 1')

  // One reminder for the break, however many prompts.
  await $.prompt.submit({ text: 'keep going', wait: false, origin: ORIGIN })
  await $.prompt.submit({ text: 'and this', wait: false, origin: ORIGIN })
  expect(toasts.filter(t => t.includes('还在休息时间'))).toHaveLength(1)

  // A two-minute task finishing in the break is held back.
  await $.turn.start({ turnId: 't1', text: 'long job' })
  await clock.advance(2 * MIN)
  await $.turn.complete({ turnId: 't1', answer: 'ok', isAborted: false, reason: 'answer', durationMs: 2 * MIN })
  expect(toasts.some(t => t.includes('2 分钟的任务完成'))).toBe(false)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /休息结束后告诉你/ }))?.text).toContain('2 分钟的任务')
  expect((await ui.find({ type: 'Text', text: /^今天/ }))?.text).toBe('今天：🍅')
  await ui.unmount()

  await clock.advance(3 * MIN)
  expect(toasts.at(-1)).toContain('休息期间完成了：一个 2 分钟的任务')
  expect(statuses.at(-1)).toBe('🍅 今日 1')
})

test('stop cancels a pomodoro without counting it', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on, { now: T0 })
  on('command.register', () => ({ value: { command: 'pomo' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ ...RUN, command: 'pomo', args: 'start 10' })
  await clock.advance(4 * MIN)
  expect((await $.command.run({ ...RUN, command: 'pomo', args: 'stop' })).text).toContain('不计入')
  await clock.advance(10 * MIN)
  expect((await $.command.run({ ...RUN, command: 'pomo', args: 'status' })).text).toContain('今天完成 0 个')
})
