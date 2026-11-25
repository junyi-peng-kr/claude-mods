/** What a turn mostly did: reads, edits, commands, subagents, the web, or no tools. */
export type PlantKind = 'grass' | 'flower' | 'tree' | 'mushroom' | 'vine' | 'sprout'

export type Plant = { kind: PlantKind; turn: number; at: number; seed: number }

export type Garden = {
  plants: Plant[]
  /** Context window fill, 0-100. */
  pct: number
  tokens: number
  window: number
  /** Turns planted since the last replant. */
  turns: number
  /** Replants so far this session (a compaction or /clear). */
  replants: number
  /** The 80% nudge was shown for this planting. */
  isWarned: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'token-garden': {
      garden: Shaped<Garden>
    }
  }
}
