# NEON PILOT

A mecha-cockpit look for Claude Code.

## What it changes

- **Background**: a night hangar drawn as vector art. It has a hex wall, a perspective deck, neon gantries with the NEON PILOT wordmark, and the mecha KX-07, whose cyan visor slowly brightens and dims. A faint scanline crosses the screen every 14 seconds. Nothing flashes, and the scene holds still for people who turned on reduced motion.
- **Colors**: dark violet planes, with cyan `#2EF2FF` as the accent, magenta `#FF2E88` for alarms and yellow `#FFD84A` for warnings.
- **Messages**: your messages and Claude's replies are chamfered HUD plates. Yours has a cyan corner, and Claude's has a magenta one. Tool rows are set in the code font with a thin square border.
- **Cockpit dashboard**: a side panel that fills its height. From top to bottom:
  - The pilot & KX-07 illustration.
  - Mission alerts, when one is showing.
  - The system stage: STANDBY under 30% of the context window, LINKED from 30% to 70%, OVERDRIVE from 70% to 90%, and CRITICAL above 90% or when a turn runs past 3 minutes. Below it, a 20-cell LINK bar.
  - Telemetry: model, repo, branch, turns, tool calls, last turn and session time.
  - Usage: the 5-hour and 7-day rate limits and the session cost.
- **Mission alerts**, shown in the dashboard and as toasts:
  - **ALL GREEN**: tests pass.
  - **LAUNCH**: `git push` or `gh pr create` succeeds.
  - **MISSION CLEAR**: a turn longer than 3 minutes finishes.
  - **SYSTEM CHECK**: shown before a `git push` runs, reminding you to run lint and tests first. It doesn't block the push.
- **Combat**, with the `boss-fight` mod installed:
  - **ENEMY CONTACT**: failing tests summon a boss.
  - **TARGET DOWN**: a green run defeats it.
  - While the fight runs, and no other alert is showing, an **ENGAGED · 交战中** lock-on card at the foot of the illustration shows the enemy and its HP. boss-fight draws its own panel as KX-07 fighting the boss.
- **Above the prompt**: while the look is on, the mod hides the row that the `usage-band` mod draws there, because the dashboard already shows those figures.

The background, colors and message styles need the Claude desktop app, on Claude Code v2.1.324 or later. The terminal shows the dashboard as colored text.

The labels use Rajdhani, Share Tech Mono and Noto Sans SC when they're installed. Otherwise they fall back to system fonts.

## Commands

- `/neon on` turns the look and the dashboard on. They're on by default.
- `/neon off` turns everything off. The choice is kept across sessions.
- `/neon panel` reopens the dashboard after you close it.
- `/neon demo` plays the six alerts in a row.

Only one look shows at a time. If another mod has set a look, turn that one off first.
