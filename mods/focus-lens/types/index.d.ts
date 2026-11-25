export type Focus = {
  /** The goal as the user typed it; '' when none is set. */
  goal: string
  /** Words the goal is matched by: its own, plus hints for Chinese terms. */
  words: string[]
  /** Files (relative or absolute as edited) judged on the goal so far. */
  known: string[]
  /** Files already named in an off-goal toast, so they are not named again. */
  warned: string[]
  /** Epoch ms the goal was set. */
  setAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'focus-lens': {
      focus: Shaped<Focus>
    }
  }
}
