export type Tint = 'green' | 'amber'

export type Job = {
  n: number
  tool: string
  label: string
  start: number
  end?: number
  status: 'run' | 'ok' | 'abend' | 'held'
}

declare module 'claude-code' {
  interface PluginState {
    'terminal-1983': {
      jobs: Shaped<Job[]>
      tint: Tint
      isOn: boolean
    }
    /** Read only: another look mod's switch. */
    'neon-pilot': { isOn: boolean }
    /** Read only: another look mod's switch. */
    'ink-paper': { isOn: boolean }
    /** Read only: another look mod's switch. */
    'seasons': { isOn: boolean }
  }
}
