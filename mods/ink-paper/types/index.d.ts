/** Whether the look is on; kept across sessions in the store too. */
export type InkSwitch = boolean

declare module 'claude-code' {
  interface PluginState {
    'ink-paper': {
      isOn: InkSwitch
    }
    /** Read only: another look mod's switch. */
    'neon-pilot': { isOn: boolean }
    /** Read only: another look mod's switch. */
    'terminal-1983': { isOn: boolean }
    /** Read only: another look mod's switch. */
    'seasons': { isOn: boolean }
  }
}
