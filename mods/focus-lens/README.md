# FOCUS LENS

Set one goal for the session and keep Claude on it.

## What it does

- **`/lens <goal>`** sets the session's goal, for example `/lens 修复登录页 token 过期` or `/lens fix the expired-token bug on login`. It shows in the status line as `🎯 <goal>`.
- **The system prompt** gets a short section with the goal. It asks Claude to stay within the goal, and to say so and ask before changing anything outside it: an unrelated refactor, a drive-by fix, reformatting other files.
- **After each turn**, the files Claude edited are checked against the goal. A file counts as on the goal when:
  - a word in its path matches a word of the goal (`LoginForm.tsx` matches "login"),
  - it was judged on the goal earlier in the session, or
  - it sits in the same folder (two or more levels deep) as one that was.

  Common Chinese terms map to the words code uses: 登录 → login/signin/auth, 支付 → pay/payment/billing, 数据库 → db/migration/schema, and so on. A goal with no words to match learns from its first turn of edits. Lockfiles count neither way.
- **If more than half of a turn's files look unrelated**, one gentle toast names them: `这一轮改了 Button.tsx、colors.ts，好像超出了「修复登录页 token 过期」`. You're told about each file once.

## Commands

The command is `/lens`, because Claude Code already has built-in `/focus` and `/goal` commands.

- `/lens <goal>` sets or replaces the goal.
- `/lens` shows the goal, the words it's matched by, the files judged on it and those flagged off it.
- `/lens clear` removes the goal, the prompt section and the status line.

The goal lasts for the session only. It survives a reload of the mod, but a new session starts without one.
