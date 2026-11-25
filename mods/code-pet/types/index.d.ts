export type Stage = 'egg' | 'baby' | 'kid' | 'adult'

/** `bit` is the original blob that changes colour as it grows. */
export type Species = 'bit' | 'corgi' | 'shiba' | 'cat' | 'bunny'

export type Pet = {
  name: string
  species: Species
  /** A key of the species' coats (corgi: tricolor, red, sable; …). */
  coat: string
  /** Epoch ms the egg was laid. */
  born: number
  xp: number
  /** 0-100; falls over time, filled by passing tests. */
  food: number
  /** 0-100; falls over time and on failures, lifted by commits and pats. */
  joy: number
  /** Epoch ms of the last decay step. */
  lastTick: number
  /** Epoch ms of the last coding activity (an edit, a commit, a test). */
  lastActive: number
  /** Epoch ms of the last pat, to space pats out. */
  lastPatAt: number
  /** Local dates (YYYY-MM-DD) the pet saw you code, newest last, at most 60. */
  days: string[]
  /** Lifetime counters. */
  meals: number
  commits: number
  stumbles: number
}

export type ReactionKind = 'eat' | 'happy' | 'sad' | 'evolve' | 'pat'

export type Reaction = { kind: ReactionKind; text: string; id: number }

declare module 'claude-code' {
  interface PluginState {
    'code-pet': {
      pet: Shaped<Pet>
      reaction: Shaped<Reaction | null>
      isOn: boolean
    }
  }
}
