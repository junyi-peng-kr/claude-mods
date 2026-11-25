/** One secret found: the rule, where, and the line with the value masked. */
export type Finding = {
  rule: string
  label: string
  /** File the text goes to, relative or absolute as the call named it; '' for free text. */
  path: string
  /** 1-based line within the scanned text (or the file, for a staged diff). */
  line: number
  /** The line with the secret replaced by a mask; never the secret itself. */
  masked: string
}

export type Sniffs = { blocked: number; recent: Array<Finding & { at: number }> }

declare module 'claude-code' {
  interface PluginState {
    'secret-sniffer': {
      sniffs: Shaped<Sniffs>
    }
  }
}
