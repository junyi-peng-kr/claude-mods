export type Level = 'warn' | 'ask' | 'block'

/** `bash` rules match the command line; `file` rules match the path a file tool writes. */
export type Target = 'bash' | 'file'

export type Rule = {
  id: string
  level: Level
  target: Target
  /** A regular expression's source, matched case-insensitively. */
  pattern: string
  /** What the rule protects against, in a few words. */
  label: string
  /** True for the rules the mod ships. */
  isBuiltIn?: boolean
}

export type Event = { at: number; level: Level; label: string; detail: string; ruleId: string }

export type Tally = { block: number; ask: number; warn: number; recent: Event[] }

declare module 'claude-code' {
  interface PluginState {
    'safe-harbor': {
      tally: Shaped<Tally>
    }
  }
}
