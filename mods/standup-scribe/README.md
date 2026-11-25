# STANDUP SCRIBE

Keeps a daily log of your coding sessions, for each repository, and turns it into a standup.

## What it records

For each local day and each repository (named after the session folder's git root):

- **Commits**: after a successful `git commit`, the new commit's short hash and subject, read back with `git log -1`.
- **PRs opened**: the URL from `gh pr create`, or from a GitHub tool that creates a pull request.
- **Files edited** by Claude's Edit, Write and NotebookEdit calls.
- **Test runs**: passed or failed, with the command and the number of failures.
- **What you asked for**: the first line of each prompt you send. These show up as "在做" on a day with no commits.

The log is kept in the mod's store for the last 14 days, across sessions and projects.

## The standup

`/scribe` prints three sections:

- **昨天**: the last earlier day with any activity, so Friday's work shows up on Monday.
- **今天**: what has happened so far today.
- **阻塞**: tests whose last run of the day failed (yesterday's count only if nothing has passed since), and files edited after a day's last commit that are still uncommitted.

`/scribe md` prints the same and writes it as Markdown to `~/.claude/standups/<date>.md`. `/scribe clear` empties the log.

The command is `/scribe` rather than `/standup`, because the engineering plugin already has a `/standup`.

## For Claude

The mod registers a tool, `standup_log`, which returns the raw log for a date range (`from`, `to`, `repo`; by default the last two active days). Ask Claude something like "写一下今天的站会" or "what did I do this week?" and it can write the summary in its own words from the log.
