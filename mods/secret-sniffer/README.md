# SECRET SNIFFER

Stops secrets before they land in a file or a commit. It checks what is about to be written, not file paths. `safe-harbor` covers paths such as `~/.ssh`.

## What it checks

- **File writes**: the content of `Write`, the new text of `Edit` and `MultiEdit`, and the new source of `NotebookEdit`.
- **Commits**: before `git commit` runs, the lines it would add (`git diff --cached`, or against `HEAD` for `commit -a`).

## What it looks for

Private key headers, AWS access key IDs and secret keys, GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`), Anthropic `sk-ant-` keys, OpenAI-style `sk-` keys, Slack tokens and webhook URLs, Google `AIza…` API keys, Stripe live keys and JSON Web Tokens. It also catches a random-looking value of 12 or more characters assigned to a key named like `secret`, `token`, `password`, `api_key` or `client_secret`.

It skips obvious placeholders such as `xxxx`, `<your-key>`, `EXAMPLE`, `changeme`, `****`, `${VAR}`, `dummy` and `sample`, and reads from the environment such as `process.env.X`.

## When it finds one

The call is refused. Claude is told the rule and the file and line, with the value masked (`ghp_…[40 chars masked]`), and is asked to load the secret from the environment instead. A toast says the same. The secret itself is never echoed.

## Commands

- `/sniffer` shows whether it's on, how many calls it refused this session, the last findings and your allow list.
- `/sniffer test <text>` says whether some text would be refused.
- `/sniffer allow <regex>` skips any file path or line the regex matches, for test fixtures for example: `/sniffer allow tests/fixtures/`. `/sniffer unallow <regex>` removes one.
- `/sniffer off` / `/sniffer on` turns the check off or on.

The allow list and the on/off switch are kept across sessions. If the check itself fails, the call is refused rather than let through.
