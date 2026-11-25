export type Tier = 'minion' | 'elite' | 'overlord'

export type Boss = {
  /** What the boss is named after: the first failing test, or the command. */
  name: string
  /** Its kind, picked from the seed: 史莱姆, 骷髅骑士, … */
  kind: string
  tier: Tier
  maxHp: number
  hp: number
  seed: number
}

export type LogKind = 'spawn' | 'hit' | 'heal' | 'miss' | 'win' | 'flee'

export type LogLine = { at: number; kind: LogKind; text: string }

export type Battle = {
  status: 'idle' | 'fighting' | 'won' | 'fled'
  boss: Boss | null
  startedAt: number
  endedAt: number
  /** Test runs since the boss appeared. */
  rounds: number
  /** Tool calls since the boss appeared. */
  actions: number
  log: LogLine[]
  /** Bumped on every hit, so the drawing can play the hit once. */
  hitId: number
}

export type Win = { name: string; kind: string; maxHp: number; rounds: number; ms: number; at: number }

export type Records = { wins: number; flees: number; damage: number; fastestMs: number; recent: Win[] }

declare module 'claude-code' {
  interface PluginState {
    'boss-fight': {
      battle: Shaped<Battle>
      records: Shaped<Records>
    }
  }
}
