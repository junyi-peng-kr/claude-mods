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

/**
 * The fight as other mods read it (neon-pilot's cockpit does): plain data,
 * `seq` bumped on every change, `event` naming what the change was.
 */
export type Combat = {
  status: Battle['status']
  event: LogKind | 'none'
  seq: number
  kind: string
  name: string
  tier: Tier
  hp: number
  maxHp: number
  rounds: number
}

declare module 'claude-code' {
  interface PluginState {
    'boss-fight': {
      battle: Shaped<Battle>
      records: Shaped<Records>
      combat: Combat
    }
    /** Read only: whether NEON PILOT's look is on, which switches the fight to mecha mode. */
    'neon-pilot': {
      isOn: boolean
    }
  }
}
