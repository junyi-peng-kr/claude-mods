import { describe, expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { isOnGoal, judgeTurn, shouldWarn, wordsOf } from './match'
import { sectionText } from './register'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

describe('matching', () => {
  test('goal words, English and Chinese', () => {
    expect(wordsOf('Fix the expired token on the login page')).toEqual(['expired', 'token', 'login'])
    expect(wordsOf('修复登录页 token 过期')).toEqual(expect.arrayContaining(['token', 'login', 'auth']))
    expect(wordsOf('优化一下')).toEqual([])
  })

  test('a path is on the goal by its words, by an earlier file, or by its folder', () => {
    const w = wordsOf('fix login token expiry')
    expect(isOnGoal('src/components/LoginForm.tsx', w, [])).toBe(true)
    expect(isOnGoal('src/auth/refresh_token.ts', w, [])).toBe(true)
    expect(isOnGoal('src/ui/Button.tsx', w, [])).toBe(false)
    expect(isOnGoal('src/auth/session.ts', w, ['src/auth/refresh_token.ts'])).toBe(true)
    // A shallow folder is not enough.
    expect(isOnGoal('src/util.ts', w, ['src/login.ts'])).toBe(false)
  })

  test('a turn warns only when more than half is off, and only about new files', () => {
    const w = wordsOf('login')
    const v = judgeTurn(['src/login.ts', 'src/ui/Button.tsx', 'README.md', 'package-lock.json'], w, [])
    expect(v).toEqual({ on: ['src/login.ts'], off: ['src/ui/Button.tsx', 'README.md'] })
    expect(shouldWarn(v, [])).toEqual(['src/ui/Button.tsx', 'README.md'])
    expect(shouldWarn(v, ['src/ui/Button.tsx', 'README.md'])).toEqual([])
    expect(shouldWarn(judgeTurn(['src/login.ts', 'README.md'], w, []), [])).toEqual([])
  })

  test('a goal with no words learns its first turn', () => {
    expect(judgeTurn(['a/b/c.ts'], [], [])).toEqual({ on: ['a/b/c.ts'], off: [] })
  })
})

function world(on: Parameters<TestBody>[1], toasts: string[]) {
  on('command.register', () => ({ value: { command: 'lens' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
}

const COMPOSE = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: ['desktop'],
  tools: [],
  outputStyle: null,
  traits: [],
} as const

test('the goal joins the system prompt, and a wandering turn gets one toast', async ($, on) => {
  mock.store(on)
  const toasts: string[] = []
  world(on, toasts)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude.', scope: 'shared' }] }))
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })

  // No goal: the prompt is untouched.
  expect((await $.prompt.compose(COMPOSE)).sections.map(s => s.id)).toEqual(['intro'])

  const set = await $.command.run({ ...RUN, command: 'lens', args: '修复登录页 token 过期' })
  expect(set.text).toContain('login')
  const composed = await $.prompt.compose(COMPOSE)
  expect(composed.sections.at(-1)).toEqual({ id: 'focus-lens:goal', text: sectionText('修复登录页 token 过期'), scope: 'session' })

  const turn = async (files: string[]) => {
    await $.turn.start({ text: 'go', turnId: 't' })
    for (const f of files) await $.tool.call({ tool: 'Edit', file_path: `/repo/${f}`, old_string: 'a', new_string: 'b' })
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
  }

  await turn(['src/auth/login.ts', 'src/auth/token.ts'])
  expect(toasts).toEqual([])

  await turn(['src/ui/Button.tsx', 'src/theme/colors.ts', 'src/auth/login.ts'])
  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toContain('Button.tsx、colors.ts')
  expect(toasts[0]).toContain('修复登录页')

  // The same files again: no second toast.
  await turn(['src/ui/Button.tsx', 'src/theme/colors.ts'])
  expect(toasts).toHaveLength(1)

  expect((await $.command.run({ ...RUN, command: 'lens', args: 'clear' })).text).toContain('清除')
  expect((await $.prompt.compose(COMPOSE)).sections.map(s => s.id)).toEqual(['intro'])
})
