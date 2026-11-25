export type Stage = 'STANDBY' | 'LINKED' | 'OVERDRIVE' | 'CRITICAL'

export type Hud = {
  model: string
  repo: string
  branch: string
  /** Context window fill, 0-100. */
  pct: number
  /** A turn has been running for more than 3 minutes. */
  isLong: boolean
  isWorking: boolean
  turns: number
  tools: number
  /** Session start, epoch ms. */
  startedAt: number
  /** Last finished turn's length, ms; 0 before one. */
  lastTurnMs: number
  /** Context tokens in use and the window. */
  tokens: number
  window: number
  /** Rate-limit windows: five_hour, seven_day, … */
  limits: Array<{ kind: string; pct: number; resetsAt?: string }>
  /** Session cost in USD; absent where the host keeps no ledger. */
  usd?: number
}

export type FlashKind = 'green' | 'launch' | 'clear' | 'check' | 'contact' | 'down'

export type Flash = { kind: FlashKind; sub: string; detail: string; id: number }

/** The fight boss-fight publishes, read when that mod is installed. */
export type Combat = {
  status: 'idle' | 'fighting' | 'won' | 'fled'
  event: string
  seq: number
  kind: string
  name: string
  tier: string
  hp: number
  maxHp: number
  rounds: number
}

declare module 'claude-code' {
  interface PluginState {
    'neon-pilot': {
      hud: Shaped<Hud>
      flash: Shaped<Flash | null>
      isOn: boolean
    }
    /** Read only: boss-fight's own value. */
    'boss-fight': {
      combat: Combat
    }
    /** Read only: another look mod's switch. */
    'terminal-1983': { isOn: boolean }
    /** Read only: another look mod's switch. */
    'ink-paper': { isOn: boolean }
    /** Read only: another look mod's switch. */
    'seasons': { isOn: boolean }
  }
}
