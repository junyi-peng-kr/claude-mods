# BRANCH WARDEN

Keeps Claude's work off your protected branches.

## What it does

- **Protected branches**: `main`, `master`, `trunk`, `develop`, `production` and `release/*` by default.
- **On a protected branch, the first file edit inside the repository** is asked about. The question suggests a branch to switch to, such as `git switch -c claude/20261124-2130`. If you say yes, Claude can edit on that branch for the rest of the session.
- **Every `git commit` on a protected branch** is asked about.
- **Modes**: `ask` (the default) puts each of these to you, even in a mode or under a rule that would let it run. `block` refuses them and tells Claude to create a branch first. `warn` lets them run with a toast.
- **Status line**: shows the current branch, for example `⎇ feat/login`, or `⎇ main ⚠ 受保护分支` on a protected branch.

Edits to files outside the repository, and every other git command, are left alone. The branch is read again after `git checkout`, `switch`, `branch`, `rebase`, `merge`, `pull`, `stash` and `gh pr checkout`.

## Commands

- `/warden` shows the branch, the mode and the protected list.
- `/warden allow` lets Claude edit on the current branch for this session. Commits are still asked about.
- `/warden mode <ask|block|warn>` sets the mode.
- `/warden protect <branch>` and `/warden unprotect <branch>` change the list. A pattern such as `hotfix/*` matches by prefix.
- `/warden off` / `/warden on` turns the guard off or on.

The mode, the list and the on/off switch are kept across sessions. Where nobody can be asked, such as a `claude -p` run, an ask is refused.

Force-pushing to `main` is a separate check: `safe-harbor` covers it.
