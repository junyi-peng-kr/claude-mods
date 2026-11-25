# claude-mods

A library of mods for [Claude Code](https://code.claude.com/docs/en/plugins/mods/overview). Each mod lives in its own folder under `mods/`, and this repository is a marketplace, so you can install any of them with one line.

| Mod | What it does |
| --- | --- |
| [`neon-pilot`](mods/neon-pilot) | A mecha-cockpit look: a night-hangar background with the mecha KX-07, HUD-plate messages, and a cockpit dashboard in the side panel with mission alerts and a pre-push system check. |
| [`code-pet`](mods/code-pet) | A pixel pet in the side panel: a blob, a corgi, a shiba, a cat or a bunny, in the coat and with the name you choose. Passing tests feed it, commits cheer it up, failures upset it, and it grows from egg to adult as you code. The same pet is kept across sessions. |
| [`boss-fight`](mods/boss-fight) | Failing tests become a pixel boss whose HP is the number of failures. Each test run is a round, a green run defeats it, and your fastest kills are recorded. With `neon-pilot` on, KX-07 fights the boss, and the cockpit shows ENEMY CONTACT, TARGET DOWN and a lock-on card. |
| [`safe-harbor`](mods/safe-harbor) | Guards dangerous tool calls in three levels. It blocks `rm -rf /` and force-pushes to main, asks before `reset --hard`, `DROP TABLE`, `curl \| sh` and `.env` writes, and warns about `sudo`. Edit the rules with `/harbor`. |
| [`diff-radar`](mods/diff-radar) | The working tree as a radar scope: each changed file is a blip, placed by folder and how recently it was edited, sized by lines changed and coloured by edit count. It warns when Claude keeps rewriting the same file. |
| [`terminal-1983`](mods/terminal-1983) | A phosphor CRT look in green or amber: a scanline tube behind the conversation, square mono message boxes, a low hum, and a mainframe-style job log of tool calls. |
| [`branch-warden`](mods/branch-warden) | Keeps Claude off `main`: on a protected branch it asks (or blocks) before the first file edit and before every commit, suggests a branch, and shows the branch in the status line. |
| [`flight-recorder`](mods/flight-recorder) | A black box for the session: a waterfall of every turn's tool calls by kind, the slowest and failed calls, and `/recorder export` to Markdown. |
| [`ink-paper`](mods/ink-paper) | A look in two modes: rice paper by day and lamp-lit ink by night, with an ink-wash landscape behind the conversation and seal-cornered messages. The status line shows the solar term (节气) and the double hour (时辰). |
| [`seasons`](mods/seasons) | A look that changes with the real season and time of day: cherry petals in spring, fireflies on summer nights, maple leaves in autumn and snow in winter, each with its own palette in light and dark. |
| [`token-garden`](mods/token-garden) | A garden for the context window. Each turn grows a plant that shows what the turn did, and the garden dries and wilts as the context fills, with a nudge to `/compact` before it's full. |
| [`pomodoro-pilot`](mods/pomodoro-pilot) | A pomodoro timer. The countdown sits in the status line and a toast marks the end of each focus and break. Reminders during a break are quiet, and done-toasts wait until the break is over. |
| [`secret-sniffer`](mods/secret-sniffer) | Stops secrets before they land. It scans what Claude writes into files and what a commit stages for API keys, tokens, private keys and JWTs, and refuses the call with the value masked. |
| [`focus-lens`](mods/focus-lens) | Set a goal for the session with `/lens`. The goal sits in the status line and in Claude's instructions, and a gentle toast says when a turn's edits seem to wander outside it. |
| [`standup-scribe`](mods/standup-scribe) | A daily log of commits, PRs, edited files, test runs and prompts for each repository. `/scribe` turns it into a yesterday / today / blockers standup, and Claude can read it through a tool. |
| [`narrator`](mods/narrator) | Narrates Claude's work in a literary voice: wuxia, detective, space opera or nature documentary. Every tool call gets a line in the status bar, and the moments that matter get a toast. |

## Install a mod

At the prompt of a Claude Code terminal session:

```
/plugin install neon-pilot --marketplace junyi-peng-kr/claude-mods
```

Answer `y` to add the marketplace, then pick a scope (user scope is first).

From a shell:

```bash
claude plugin install neon-pilot --marketplace junyi-peng-kr/claude-mods
```

In the desktop app, where `/plugin` doesn't run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `junyi-peng-kr/claude-mods`, then **Add plugin**.

## Update

After a new version is pushed:

```bash
claude plugin marketplace update claude-mods
```

```bash
claude plugin update neon-pilot
```

Then start a new session.

## Adding a mod

Put the mod in `mods/<name>/` with its own `.claude-plugin/plugin.json`, add an entry to `.claude-plugin/marketplace.json`, and run `claude plugin validate mods/<name>`. Bump the mod's `version` whenever you change it, or `claude plugin update` won't pick up the change.

## License

MIT. See [LICENSE](LICENSE).
