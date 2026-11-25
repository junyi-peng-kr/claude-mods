import { expect, mock, test } from 'claude-code/testing'

import { parseSceneId, seasonOf, timeOf } from './four'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

test('seasons and time of day by date', () => {
  expect(seasonOf(new Date(2026, 2, 1))).toBe('spring')
  expect(seasonOf(new Date(2026, 5, 15))).toBe('summer')
  expect(seasonOf(new Date(2026, 10, 24))).toBe('autumn')
  expect(seasonOf(new Date(2026, 11, 1))).toBe('winter')
  expect(seasonOf(new Date(2026, 1, 28))).toBe('winter')
  expect(timeOf(new Date(2026, 0, 1, 5, 59))).toBe('night')
  expect(timeOf(new Date(2026, 0, 1, 6, 0))).toBe('day')
  expect(timeOf(new Date(2026, 0, 1, 17, 59))).toBe('day')
  expect(timeOf(new Date(2026, 0, 1, 18, 0))).toBe('night')
  expect(parseSceneId('seasons-autumn-night')).toEqual({ season: 'autumn', time: 'night' })
  expect(parseSceneId('neon-hangar')).toBeUndefined()
})

test('the look follows now, a preview holds, and auto lets go', async ($, on) => {
  mock.store(on, { 'seasons.isOn': true })
  const scenes: string[] = []
  on('command.register', () => ({ value: { command: 'seasons' } }))
  on('theme.set', (_, e) => {
    const backdrop = e.backdrop as { scene?: string } | undefined
    if (backdrop?.scene) scenes.push(backdrop.scene)
    return { value: { isDrawn: true, requestId: 'look' } }
  })
  on('theme.clear', () => ({ value: { isDrawn: true, requestId: 'clear' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const now = new Date()
  const expected = `seasons-${seasonOf(now)}-${timeOf(now)}`
  expect(scenes).toEqual([expected])

  const preview = await $.command.run({ ...RUN, command: 'seasons', args: 'preview winter night' })
  expect(preview.text).toContain('冬')
  expect(scenes.at(-1)).toBe('seasons-winter-night')

  const bad = await $.command.run({ ...RUN, command: 'seasons', args: 'preview monsoon' })
  expect(bad.text).toContain('用法')

  await $.command.run({ ...RUN, command: 'seasons', args: 'auto' })
  expect(scenes.at(-1)).toBe(expected)

  const off = await $.command.run({ ...RUN, command: 'seasons', args: 'off' })
  expect(off.text).toContain('/seasons on')
})
