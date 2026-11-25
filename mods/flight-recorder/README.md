# FLIGHT RECORDER

A black box for your Claude Code session. It records every turn and every tool call in it: when each call started, how long it took, what kind it was and whether it failed.

## The panel

- **Waterfall**: the last 5 turns, newest on top. Each bar is one tool call, placed by its start time and sized by its length, so calls that ran in parallel sit in separate lanes. Colors mark the kind: read (blue), write (green), exec (orange), subagent (purple), web (pink), MCP (teal), other (grey). Failed or refused calls have a red outline, and calls made inside a subagent are drawn paler. Hover a bar in the desktop app to see the tool, its length and what it did.
- **Totals**: turns, tool calls, failures and time spent in turns.
- **Slowest calls** and the **latest failures**, with the turn they were in.
- **导出 Markdown** and **清空** buttons.

## Commands

- `/recorder` opens the panel.
- `/recorder stats` prints totals by kind, the most-used tool and the three slowest calls.
- `/recorder export` writes the whole log as Markdown to `~/.claude/flight-recorder/<repo>-<YYYYMMDD-HHmm>.md`. You get each turn's prompt and a table of its calls, which is handy for a PR description or a retro.
- `/recorder clear` empties the log.

The recorder keeps the last 40 turns of the session, and up to 200 calls in each. It survives a reload of the mod but not a new session. Export the log first if you want to keep it.

The terminal shows each turn as text, with its last 6 calls.
