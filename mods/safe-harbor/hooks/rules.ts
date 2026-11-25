// The rules SAFE HARBOR ships, and matching a call against a rule list.
import type { Level, Rule, Target } from '../types'

const RM_RF = String.raw`\brm\s+(?:-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*|-r\s+-f|-f\s+-r|--recursive\s+--force|--force\s+--recursive)`

export const BUILT_IN: Rule[] = [
  // ── block: no project needs these from an assistant ───────────────────────
  {
    id: 'rm-root',
    level: 'block',
    target: 'bash',
    pattern: String.raw`${RM_RF}\s+(?:--no-preserve-root\s+)?(?:/|/\*|~/?|~/\*|\$HOME/?|\$\{HOME\}/?|\.\./?)(?:\s|$|;|&|\|)`,
    label: 'rm -rf 删除根目录、家目录或上级目录',
  },
  {
    id: 'disk-wipe',
    level: 'block',
    target: 'bash',
    pattern: String.raw`\bmkfs(?:\.\w+)?\b|\bdd\b[^\n]*\bof=/dev/(?:disk|sd|nvme|hd)|>\s*/dev/(?:disk|sd|nvme)\w*|\bdiskutil\s+(?:erase\w*|zeroDisk|secureErase)`,
    label: '格式化或覆写磁盘',
  },
  {
    id: 'fork-bomb',
    level: 'block',
    target: 'bash',
    pattern: String.raw`:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:`,
    label: 'fork 炸弹',
  },
  {
    id: 'force-push-main',
    level: 'block',
    target: 'bash',
    pattern: String.raw`\bgit\s+push\b(?=[^;&|\n]*(?:\s--force(?:-with-lease)?\b|\s-f\b|\s\+\S))(?=[^;&|\n]*\b(?:main|master|trunk|production|prod|release)\b)`,
    label: '强推到 main / master 等主干分支',
  },
  {
    id: 'secret-files',
    level: 'block',
    target: 'file',
    pattern: String.raw`(?:^|/)(?:\.ssh/|\.aws/credentials$|\.gnupg/|\.netrc$|\.npmrc$|\.pypirc$|id_(?:rsa|ed25519|ecdsa|dsa)(?:\.pub)?$|\.kube/config$)`,
    label: '写入 SSH 密钥、云凭据等机密文件',
  },
  // ── ask: sometimes right, always worth a second look ──────────────────────
  {
    id: 'rm-rf',
    level: 'ask',
    target: 'bash',
    // Build output and caches that a rebuild brings back are left alone.
    pattern: String.raw`${RM_RF}(?!(?:\s+(?:\./)?(?:node_modules|dist|build|out|target|coverage|\.next|\.nuxt|\.turbo|\.cache|\.parcel-cache|__pycache__|\.pytest_cache|\.mypy_cache|\.venv|venv)/?)+\s*(?:$|[;&|]))`,
    label: 'rm -rf 递归强制删除',
  },
  {
    id: 'force-push',
    level: 'ask',
    target: 'bash',
    pattern: String.raw`\bgit\s+push\b[^;&|\n]*(?:\s--force(?:-with-lease)?\b|\s-f\b|\s\+\S)`,
    label: 'git push --force 改写远端历史',
  },
  {
    id: 'git-discard',
    level: 'ask',
    target: 'bash',
    pattern: String.raw`\bgit\s+(?:reset\s+--hard|clean\s+-[a-z]*f|checkout\s+(?:--\s+)?\.(?:\s|$)|restore\s+(?:--\S+\s+)*\.(?:\s|$)|stash\s+(?:drop|clear)|branch\s+-D)`,
    label: '丢弃未提交的改动或删除分支（reset --hard、clean -f、branch -D…）',
  },
  {
    id: 'sql-drop',
    level: 'ask',
    target: 'bash',
    pattern: String.raw`\b(?:DROP\s+(?:TABLE|DATABASE|SCHEMA|INDEX|VIEW)|TRUNCATE\s+(?:TABLE\s+)?\w|DELETE\s+FROM\s+\w+\s*(?:;|$|"|'))`,
    label: 'DROP / TRUNCATE / 不带 WHERE 的 DELETE',
  },
  {
    id: 'pipe-to-shell',
    level: 'ask',
    target: 'bash',
    pattern: String.raw`\b(?:curl|wget)\b[^|\n]*\|\s*(?:sudo\s+)?(?:ba|z|fi|da)?sh\b`,
    label: '把下载的脚本直接交给 shell 执行（curl | sh）',
  },
  {
    id: 'publish',
    level: 'ask',
    target: 'bash',
    pattern: String.raw`\b(?:npm|pnpm|yarn)\s+publish\b|\bcargo\s+publish\b|\btwine\s+upload\b|\bgem\s+push\b|\bgh\s+release\s+create\b|\bpod\s+trunk\s+push\b`,
    label: '发布包或版本（对外可见、难以撤回）',
  },
  {
    id: 'infra-destroy',
    level: 'ask',
    target: 'bash',
    pattern: String.raw`\bterraform\s+(?:destroy|apply\b[^\n]*-auto-approve)|\bkubectl\s+delete\b|\bhelm\s+(?:uninstall|delete)\b|\baws\s+s3\s+(?:rm|rb)\b[^\n]*--recursive|\bdocker\s+system\s+prune\b`,
    label: '销毁基础设施或云资源',
  },
  {
    id: 'env-redirect',
    level: 'ask',
    target: 'bash',
    pattern: String.raw`>{1,2}\s*\S*\.env(?:\.(?!example\b|sample\b|template\b)\w+)?(?:\s|$)`,
    label: '用重定向改写 .env',
  },
  {
    id: 'env-file',
    level: 'ask',
    target: 'file',
    pattern: String.raw`(?:^|/)\.env(?:\.(?!example$|sample$|template$)[\w.-]+)?$`,
    label: '修改 .env 环境变量文件',
  },
  { id: 'git-internals', level: 'ask', target: 'file', pattern: String.raw`(?:^|/)\.git/`, label: '直接改写 .git 内部文件' },
  // ── warn: allowed, but you should know ────────────────────────────────────
  { id: 'sudo', level: 'warn', target: 'bash', pattern: String.raw`(?:^|[\s;&|(])sudo\s`, label: '使用 sudo 提权' },
  {
    id: 'chmod-777',
    level: 'warn',
    target: 'bash',
    pattern: String.raw`\bchmod\s+(?:-R\s+)?(?:0?777|a\+rwx)\b`,
    label: 'chmod 777 放开全部权限',
  },
  {
    id: 'no-verify',
    level: 'warn',
    target: 'bash',
    pattern: String.raw`\bgit\s+(?:commit|push|merge|rebase)\b[^;&|\n]*\s--no-verify\b`,
    label: '--no-verify 跳过 git 钩子',
  },
  {
    id: 'lockfile-delete',
    level: 'warn',
    target: 'bash',
    pattern: String.raw`\brm\s+(?:-\w+\s+)*\S*(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|poetry\.lock|Gemfile\.lock)\b`,
    label: '删除依赖锁文件',
  },
]

export const RANK: Record<Level, number> = { warn: 1, ask: 2, block: 3 }

export const LEVEL_ZH: Record<Level, string> = { block: '拦截', ask: '需确认', warn: '提醒' }

const cache = new Map<string, RegExp | null>()

export function compile(pattern: string): RegExp | null {
  if (cache.has(pattern)) return cache.get(pattern)!
  let re: RegExp | null
  try {
    re = new RegExp(pattern, 'i')
  } catch {
    re = null
  }
  cache.set(pattern, re)
  return re
}

/** The strongest rule of `target` that `text` matches, or undefined. */
export function strongest(rules: readonly Rule[], target: Target, text: string): Rule | undefined {
  let best: Rule | undefined
  for (const rule of rules) {
    if (rule.target !== target) continue
    const re = compile(rule.pattern)
    if (!re || !re.test(text)) continue
    if (!best || RANK[rule.level] > RANK[best.level]) best = rule
  }
  return best
}

/** Collapses runs of whitespace so `git   push  -f` reads like `git push -f`. */
export const normalize = (command: string) => command.replace(/\s+/g, ' ').trim()
