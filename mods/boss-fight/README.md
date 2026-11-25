# BOSS FIGHT

Turns failing tests into a boss fight in Claude Code's side panel.

## How a fight goes

- **A boss appears** the first time a test run fails. Its HP is the number of failing tests, and it's named after the first failing test. One or two failures are a minion (小怪), 3 to 9 an elite (精英), 10 or more an overlord (魔王). Its kind and pixel look come from its name, so the same failing test always summons the same monster.
- **Each later test run is a round.** Fewer failures deal damage and the boss shakes. More failures heal it, and its max HP grows.
- **A fully green run defeats it.** You get the time, the rounds and the actions (tool calls) the fight took, and a toast says when that's your fastest kill.
- **An unfinished fight is kept** across sessions, so the boss is still there when you come back.

Test runs are recognised for npm/pnpm/yarn/bun test, jest, vitest, mocha, playwright, pytest, go test, cargo test/nextest, rspec, phpunit, deno, swift, mvn and gradle. A run that errors without printing any counts, such as a build that didn't compile, counts as one failure.

## Commands

- `/boss` opens the panel.
- `/boss flee` ends the current fight. The panel also has a **撤退** button.
- `/boss stats` prints wins, retreats, total damage, fastest kill and recent bosses.
- `/boss demo` plays a full fight: HP 5 → 3 → 4 → 1 → defeated.

The desktop app draws the boss as pixel art with an HP bar. The terminal shows the HP as a text bar.
