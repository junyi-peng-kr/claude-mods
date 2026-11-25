import { expect, mock, test } from 'claude-code/testing'

import { LINES } from './voices'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

test('every voice has lines for every beat, and none calls Claude he or she', () => {
  for (const [voice, beats] of Object.entries(LINES)) {
    for (const [beat, lines] of Object.entries(beats)) {
      expect([voice, beat, lines.length > 0]).toEqual([voice, beat, true])
      for (const l of lines) expect([voice, beat, /[他她]/.test(l)]).toEqual([voice, beat, false])
    }
  }
})

test('status narrates each call; toasts are rate-limited except results', async ($, on) => {
  mock.store(on)
  const toasts: string[] = []
  const statuses: string[] = []
  on('command.register', () => ({ value: { command: 'narrator' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    if (e.text) statuses.push(e.text)
    return { value: undefined }
  })
  on('tool.call', (_, e) =>
    e.tool === 'Bash' && e.command === 'npm test' ? { result: {}, text: 'Tests: 12 passed, 12 total' } : { result: {}, text: 'ok' },
  )

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const r = await $.command.run({ ...RUN, command: 'narrator', args: '侦探' })
  expect(r.text).toContain('旁白 · 侦探')

  await $.turn.start({ text: 'fix it', turnId: 't1' })
  await $.tool.call({ tool: 'Read', file_path: '/repo/src/auth.ts' })
  expect(statuses.at(-1)).toContain('auth.ts')
  expect(statuses.at(-1)).toContain('侦探')
  expect(toasts).toHaveLength(1)

  await $.tool.call({ tool: 'Read', file_path: '/repo/src/token.ts' })
  expect(toasts).toHaveLength(1)

  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(toasts).toHaveLength(2)
  expect(toasts[1]).toMatch(/12 项|案子结了|真相大白/)

  const s = await $.command.run({ ...RUN, command: 'narrator', args: 'sample' })
  expect((s.text ?? '').split('\n').length).toBe(10)

  await $.command.run({ ...RUN, command: 'narrator', args: 'off' })
  const before = statuses.length
  await $.tool.call({ tool: 'Read', file_path: '/repo/src/x.ts' })
  expect(statuses.length).toBe(before)
})
