// The look mods of claude-mods share one window: only one theme shows at a time.
// This reads the other looks' on/off switches (each publishes `isOn` in its state)
// so turning one on can say which others are still on, and how to turn them off.
import type { EngineInterface } from 'claude-code'

type Read = () => Promise<{ value?: boolean | undefined }>

async function isOn(read: Read): Promise<boolean> {
  try {
    return (await read()).value === true
  } catch {
    return false
  }
}

/** A sentence naming the other looks that are on, or '' when none is. */
export async function otherLooksOn($: EngineInterface, self: string): Promise<string> {
  const looks: Array<[string, string, Read]> = [
    ['neon-pilot', '/neon off', () => $.state.get({ plugin: 'neon-pilot', key: 'isOn' } as const)],
    ['terminal-1983', '/crt off', () => $.state.get({ plugin: 'terminal-1983', key: 'isOn' } as const)],
    ['ink-paper', '/ink off', () => $.state.get({ plugin: 'ink-paper', key: 'isOn' } as const)],
    ['seasons', '/seasons off', () => $.state.get({ plugin: 'seasons', key: 'isOn' } as const)],
  ]
  const on: string[] = []
  for (const [name, off, read] of looks) {
    if (name !== self && (await isOn(read))) on.push(`${name}（${off}）`)
  }
  return on.length
    ? `\n注意：${on.join("、")}也开着。同一时间只显示一个外观，下次开会话时它们可能盖过这个，建议关掉。`
    : ''
}
