import { expect, mock, test } from 'claude-code/testing'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

const PANE = {
  plugin: 'terminal-1983',
  component: 'Pane',
  requestId: 'crt-console',
  props: {
    title: 'console',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('the look is set with sound, then amber; tool calls are jobs', async ($, on) => {
  mock.store(on)
  const sets: Array<{ scene?: string; hasSound: boolean }> = []
  on('command.register', () => ({ value: { command: 'crt' } }))
  on('theme.set', (_, e) => {
    const backdrop = e.backdrop as { scene?: string } | undefined
    sets.push({ ...(backdrop?.scene ? { scene: backdrop.scene } : {}), hasSound: e.sound !== undefined })
    return { value: { isDrawn: true, requestId: 'look' } }
  })
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', (_, e) => (e.tool === 'Bash' ? { result: {}, text: 'boom', isError: true } : { result: {}, text: 'ok' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(sets[0]).toEqual({ scene: 'crt-green', hasSound: true })

  const r = await $.command.run({ ...RUN, command: 'crt', args: 'amber' })
  expect(r.text).toContain('P3')
  expect(sets.at(-1)?.scene).toBe('crt-amber')

  await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts' })
  await $.tool.call({ tool: 'Bash', command: 'make' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^JOB 0001/ }))?.text).toMatch(/^JOB 0001 READ +COMPLETE/)
    expect((await ui.find({ type: 'Text', text: /^JOB 0002/ }))?.text).toMatch(/^JOB 0002 BASH +ABEND/)
    expect((await ui.find({ type: 'Text', text: /JOBS/ }))?.text).toBe('2 JOBS · 1 COMPLETE · 1 ABEND')
    await ui.unmount()
  }
})
