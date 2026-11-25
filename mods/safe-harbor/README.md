# SAFE HARBOR

A guard on the tool calls Claude makes, in three levels. The status line shows what it has caught this session: `⚓ 安全港 · 拦截 1 · 确认 2 · 提醒 0`.

## The three levels

| Level | What happens | Built-in rules |
| --- | --- | --- |
| **block · 拦截** | The call is refused, and Claude is told not to work around it. | `rm -rf` on `/`, `~`, `$HOME` or `..`; `mkfs`, `dd of=/dev/…`, `diskutil erase…`; a fork bomb; force-pushing to `main`, `master`, `trunk`, `prod` or `release`; writing to `~/.ssh`, `~/.aws/credentials`, `~/.gnupg`, `.netrc`, `.npmrc`, `.pypirc`, `id_*` keys or `~/.kube/config` |
| **ask · 需确认** | You're asked first, even in a mode or under a rule that would let it run. | other `rm -rf` (build folders such as `node_modules`, `dist`, `build`, `.next` and `target` are left alone); `git push --force`; `git reset --hard`, `clean -f`, `checkout .`, `restore .`, `stash drop/clear`, `branch -D`; `DROP` / `TRUNCATE` / `DELETE` without `WHERE`; `curl … \| sh`; `npm/cargo publish`, `gh release create`; `terraform destroy`, `kubectl delete`, `helm uninstall`; writing `.env` files (not `.env.example`); editing `.git/` directly |
| **warn · 提醒** | The call runs, with a toast. | `sudo`; `chmod 777`; `--no-verify`; deleting a lockfile |

Where nobody can be asked, such as a `claude -p` run, an ask is refused.

## Commands

- `/harbor` shows the counts and the last 10 events.
- `/harbor rules` lists every rule and its id.
- `/harbor test <command or path>` tells you which rule a command or path would trigger, without running it.
- `/harbor add <block|ask|warn> <bash|file> <regex> [-- label]` adds a rule of your own. For example: `/harbor add ask bash \bprisma\s+migrate\s+reset -- 重置数据库`
- `/harbor rm <id>` deletes a rule you added, or turns off a built-in one. `/harbor enable <id>` turns a built-in one back on.
- `/harbor reset` goes back to the built-in rules.
- `/harbor off` / `/harbor on` turns the whole guard off or on.

Your rules and switches are kept across sessions. Patterns are matched case-insensitively against the command, with runs of whitespace collapsed, or against the path a file tool writes.

SAFE HARBOR adds a check. It does not replace Claude Code's permission settings or a sandbox.
