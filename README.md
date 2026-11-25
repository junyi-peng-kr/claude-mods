# claude-mods

A library of mods for [Claude Code](https://code.claude.com/docs/en/plugins/mods/overview). Each mod lives in its own folder under `mods/`, and this repository is a marketplace, so you can install any of them with one line.

| Mod | What it does |
| --- | --- |
| [`neon-pilot`](mods/neon-pilot) | A mecha-cockpit look: a night-hangar background with the mecha KX-07, HUD-plate messages, and a cockpit dashboard in the side panel with mission alerts and a pre-push system check. |
| [`code-pet`](mods/code-pet) | A pixel pet in the side panel. Passing tests feed it, commits cheer it up, failures upset it, and it grows from egg to adult as you code. The same pet is kept across sessions. |
| [`boss-fight`](mods/boss-fight) | Failing tests become a pixel boss whose HP is the number of failures. Each test run is a round, a green run defeats it, and your fastest kills are recorded. With `neon-pilot` on, KX-07 fights the boss, and the cockpit shows ENEMY CONTACT, TARGET DOWN and a lock-on card. |
| [`safe-harbor`](mods/safe-harbor) | Guards dangerous tool calls in three levels. It blocks `rm -rf /` and force-pushes to main, asks before `reset --hard`, `DROP TABLE`, `curl \| sh` and `.env` writes, and warns about `sudo`. Edit the rules with `/harbor`. |
| [`diff-radar`](mods/diff-radar) | The working tree as a radar scope: each changed file is a blip, placed by folder and how recently it was edited, sized by lines changed and coloured by edit count. It warns when Claude keeps rewriting the same file. |
| [`terminal-1983`](mods/terminal-1983) | A phosphor CRT look in green or amber: a scanline tube behind the conversation, square mono message boxes, a low hum, and a mainframe-style job log of tool calls. |
| [`branch-warden`](mods/branch-warden) | Keeps Claude off `main`: on a protected branch it asks (or blocks) before the first file edit and before every commit, suggests a branch, and shows the branch in the status line. |
| [`flight-recorder`](mods/flight-recorder) | A black box for the session: a waterfall of every turn's tool calls by kind, the slowest and failed calls, and `/recorder export` to Markdown. |

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
