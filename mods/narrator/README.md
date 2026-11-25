# NARRATOR

A storyteller for your Claude Code session. Whatever Claude is doing is narrated in a literary voice, from built-in templates (no model calls).

## Voices

- **武侠** (`wuxia`, the default): 「少侠翻开第三本秘籍《auth.ts》，凝神细读。」
- **侦探** (`detective`): 「侦探翻开第三份卷宗（auth.ts），眉头微皱……」
- **太空歌剧** (`space`): 「舰长调出第三份星图：auth.ts。」
- **纪录片** (`docu`): 「它停在第三个文件 auth.ts 前，小心地嗅了嗅。」

Each voice has several lines for each kind of moment: reading, searching, editing, writing a file, running a command, sending a subagent, the web, a test passing or failing, a commit, a push, a long turn ending, and waiting. Lines are picked at random, and the same line never comes twice in a row. Claude is called by the voice's epithet (少侠, 侦探, 舰长) or 它, never he or she.

## Where it shows

- **Status line**: one line for every tool call, and a resting line between turns.
- **Toasts**: for the first tool call of each turn, then at most one every 20 seconds. Results always get a toast: a test run passing or failing (with the count when the runner prints one), a commit (with its subject), a push, and a turn longer than 2 minutes finishing.

## Commands

- `/narrator wuxia | detective | space | docu` switches the voice. Chinese names (`武侠`, `侦探`, `太空`, `纪录片`) work too. The choice is kept across sessions.
- `/narrator sample` prints one line for each kind of moment in the current voice.
- `/narrator off` / `/narrator on` silences the narrator or brings it back.
