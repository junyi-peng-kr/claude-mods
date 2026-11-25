/** Whether the look is on; kept across sessions in the store too. */
export type InkSwitch = boolean

declare module 'claude-code' {
  interface PluginState {
    'ink-paper': {
      isOn: InkSwitch
    }
  }
}
