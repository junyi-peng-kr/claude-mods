export type Phase = 'idle' | 'focus' | 'break'

export type Pomo = {
  phase: Phase
  /** Epoch ms the phase started and ends; 0 when idle. */
  startedAt: number
  endsAt: number
  minutes: number
  /** Toasts kept back during a break, shown when it ends. */
  held: string[]
  /** The one reminder of this break was shown. */
  isReminded: boolean
  /** Focus sessions finished today, by local date (YYYY-MM-DD), newest last, at most 14 days. */
  days: Array<[string, number]>
}

declare module 'claude-code' {
  interface PluginState {
    'pomodoro-pilot': {
      pomo: Shaped<Pomo>
    }
  }
}
