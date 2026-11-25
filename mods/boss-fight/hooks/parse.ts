// Reading a test run's output: how many failed and passed, and what to name the boss after.

export const TEST_RE =
  /(^|[\s;&|(])((npm|pnpm|yarn|bun)\s+(run\s+)?test\b|npx\s+(jest|vitest|mocha|playwright)\b|(jest|vitest|pytest|mocha|rspec|phpunit)\b|go\s+test\b|cargo\s+(test|nextest)\b|python3?\s+-m\s+(pytest|unittest)\b|make\s+test\b|deno\s+test\b|swift\s+test\b|mvn\s+test\b|gradle\w*\s+test\b)/

export type TestRun = { failed: number; passed: number }

const maxOf = (text: string, re: RegExp): number | undefined => {
  let best: number | undefined
  for (const m of text.matchAll(re)) {
    const n = Number(m[1])
    if (Number.isFinite(n)) best = Math.max(best ?? 0, n)
  }
  return best
}

/**
 * Counts failures and passes in a run's output. `isError` is the exit status:
 * an erroring run that names no counts is one failure (a build that did not compile).
 */
export function parseRun(text: string, isError: boolean): TestRun {
  const failed =
    maxOf(text, /(\d+)\s+(?:failed|failing|failures?)\b/gi) ??
    maxOf(text, /failed:\s*(\d+)/gi) ??
    (() => {
      const go = text.match(/^--- FAIL:/gm)?.length
      return go && go > 0 ? go : undefined
    })()
  const passed = maxOf(text, /(\d+)\s+(?:passed|passing)\b/gi) ?? maxOf(text, /ok\s+(\d+)\s+tests?/gi) ?? 0
  if (failed !== undefined) return { failed, passed }
  if (isError || /\bFAIL(ED)?\b/.test(text)) return { failed: 1, passed }
  return { failed: 0, passed }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** The first failing test's name, as the runners print it. */
export function firstFailure(text: string): string | undefined {
  const patterns: RegExp[] = [
    /^\s*●\s+(.+?)\s*$/m, // jest
    /^\s*(?:×|✗|✕)\s+(.+?)(?:\s+\d+m?s)?\s*$/m, // vitest / mocha
    /^FAILED\s+(\S+)/m, // pytest
    /^--- FAIL:\s+(\S+)/m, // go
    /^test\s+(\S+)\s+\.\.\.\s+FAILED/m, // cargo
    /^\s*FAIL\s+(\S+)/m, // jest / vitest file line
    /^\s*\d+\)\s+(.+?)\s*$/m, // mocha numbered
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      const name = m[1].replace(/\s*›\s*/g, ' › ').replace(/^.*::/, '').trim()
      if (name) return clip(name, 36)
    }
  }
  return undefined
}

export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
