export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type TimeOfDay = 'day' | 'night'

/** What the look shows now, and whether it is a preview that the clock leaves alone. */
export type SeasonView = { season: Season; time: TimeOfDay; isPreview: boolean }

declare module 'claude-code' {
  interface PluginState {
    seasons: {
      view: Shaped<SeasonView | null>
      isOn: boolean
    }
    /** Read only: another look mod's switch. */
    'neon-pilot': { isOn: boolean }
    /** Read only: another look mod's switch. */
    'terminal-1983': { isOn: boolean }
    /** Read only: another look mod's switch. */
    'ink-paper': { isOn: boolean }
  }
}
