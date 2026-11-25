# claude-mods

A library of mods for [Claude Code](https://code.claude.com/docs/en/plugins/mods/overview). Each mod lives in its own folder under `mods/`, and this repository is a marketplace, so you can install any of them with one line.

| Mod | What it does |
| --- | --- |
| [`neon-pilot`](mods/neon-pilot) | A mecha-cockpit look: a night-hangar background with the mecha KX-07, HUD-plate messages, and a cockpit dashboard in the side panel with mission alerts and a pre-push system check. |

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
