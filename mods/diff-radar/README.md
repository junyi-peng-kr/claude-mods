# DIFF RADAR

Shows the working tree as a radar scope in the side panel, and warns when Claude keeps rewriting the same file.

## The scope

- **Every changed file is a blip**: files in `git diff HEAD`, plus untracked files, which are drawn as hollow rings.
- **Angle** is the file's folder, so files from the same folder sit in the same sector.
- **Distance** is how recently Claude edited the file. Fresh edits sit near the centre and drift outwards over 30 minutes. Files that changed but weren't touched this session sit on the rim.
- **Size** is the number of lines changed.
- **Colour** is how many times Claude edited the file this session. Cyan means it was edited at least once, yellow means half the threshold, and magenta (pulsing) means the threshold was reached. Grey means it wasn't touched this session.
- Hover a blip in the desktop app to see its path, `+/−` lines and edit count.

Under the scope is a list of the 12 hottest files, the branch, and when the last scan ran.

## The churn warning

When one file has been edited as many times as the threshold (5 by default), a toast asks whether Claude is going round in circles, and the panel opens. You're warned again at each multiple: 10, 15 and so on.

The radar rescans after file edits, after git commands that move the tree (`commit`, `checkout`, `reset`, `stash` and others), and at the end of each turn.

## Commands

- `/radar` opens the panel.
- `/radar scan` rescans now.
- `/radar reset` sets this session's edit counts back to zero.
- `/radar threshold <n>` sets how many edits count as churn, from 2 to 50. The setting is kept across sessions.

The terminal shows the list without the scope.
