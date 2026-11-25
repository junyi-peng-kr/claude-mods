// Matching edited files against the session goal. No `$` here.

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'fix', 'add', 'make', 'update', 'bug', 'bugs',
  'issue', 'change', 'changes', 'some', 'all', 'new', 'use', 'should', 'when', 'not', 'page', 'code', 'file',
  'files', 'feature', 'improve', 'refactor', 'support', 'handle', 'implement', 'clean', 'write', 'remove',
])

/** Chinese terms a goal often uses, and the words code paths use for them. */
const HINTS: Array<[string, string[]]> = [
  ['登录', ['login', 'signin', 'auth', 'session']],
  ['登出', ['logout', 'signout', 'auth', 'session']],
  ['注册', ['signup', 'register', 'auth']],
  ['认证', ['auth', 'oauth', 'token']],
  ['权限', ['permission', 'role', 'acl', 'auth', 'policy']],
  ['支付', ['pay', 'payment', 'billing', 'checkout', 'stripe']],
  ['订单', ['order', 'checkout', 'cart']],
  ['购物车', ['cart', 'checkout']],
  ['用户', ['user', 'profile', 'account']],
  ['个人资料', ['profile', 'user', 'account']],
  ['测试', ['test', 'spec', '__tests__']],
  ['文档', ['doc', 'docs', 'readme']],
  ['样式', ['css', 'scss', 'style', 'theme']],
  ['主题', ['theme', 'style', 'css']],
  ['数据库', ['db', 'database', 'migration', 'schema', 'model', 'prisma']],
  ['迁移', ['migration', 'migrate']],
  ['接口', ['api', 'route', 'routes', 'endpoint', 'handler', 'controller']],
  ['路由', ['route', 'router', 'routes']],
  ['配置', ['config', 'settings', 'env']],
  ['部署', ['deploy', 'ci', 'docker', 'workflow', 'k8s']],
  ['搜索', ['search', 'query', 'index']],
  ['缓存', ['cache', 'redis']],
  ['通知', ['notify', 'notification', 'email', 'push']],
  ['邮件', ['email', 'mail', 'smtp']],
  ['日志', ['log', 'logger', 'logging']],
  ['上传', ['upload', 'storage', 'file']],
  ['图片', ['image', 'img', 'media']],
  ['首页', ['home', 'index', 'landing']],
  ['设置', ['settings', 'preferences', 'config']],
  ['评论', ['comment', 'review']],
  ['聊天', ['chat', 'message']],
  ['表单', ['form', 'input', 'validation']],
  ['校验', ['validation', 'validate', 'schema']],
  ['国际化', ['i18n', 'locale', 'translation']],
  ['性能', ['perf', 'cache', 'benchmark']],
]

/** The words a goal is matched by. */
export function wordsOf(goal: string): string[] {
  const latin = goal
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w))
  const hinted = HINTS.flatMap(([zh, en]) => (goal.includes(zh) ? en : []))
  return [...new Set([...latin, ...hinted])]
}

/** A path's words: folders, the file name split on case, `_`, `-` and `.`. */
export function pathWords(path: string): string[] {
  return path
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9_]+|_/)
    .filter(w => w.length >= 2)
}

const NEUTRAL = /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|Gemfile\.lock|go\.sum|uv\.lock)$/

/** Lockfiles follow any change: they count neither way. */
export const isNeutral = (path: string) => NEUTRAL.test(path)

const dirOf = (p: string) => p.split('/').slice(0, -1).join('/')

/** A word matches a path word when one contains the other, both 3 letters or more. */
function wordHits(word: string, pw: string): boolean {
  if (word === pw) return true
  if (word.length < 3 || pw.length < 3) return false
  return pw.includes(word) || (word.length >= 4 && word.includes(pw))
}

/**
 * On the goal: a path word matches a goal word, or the file was judged on the
 * goal before, or it sits in a folder (two or more levels deep) with one that was.
 */
export function isOnGoal(path: string, words: readonly string[], known: readonly string[]): boolean {
  if (known.includes(path)) return true
  const pws = pathWords(path)
  if (words.some(w => pws.some(pw => wordHits(w, pw)))) return true
  const dir = dirOf(path)
  if (dir.split('/').filter(Boolean).length >= 2 && known.some(k => dirOf(k) === dir)) return true
  return false
}

export type Verdict = { on: string[]; off: string[] }

export function judgeTurn(files: readonly string[], words: readonly string[], known: readonly string[]): Verdict {
  const real = [...new Set(files)].filter(f => !isNeutral(f))
  // A goal with no words to match by learns from its first turn of edits.
  if (words.length === 0 && known.length === 0) return { on: real, off: [] }
  const on: string[] = []
  const off: string[] = []
  for (const f of real) (isOnGoal(f, words, known) ? on : off).push(f)
  return { on, off }
}

/** Warn when more than half of the turn's (non-neutral) files are off the goal and some are new to a warning. */
export function shouldWarn(v: Verdict, warned: readonly string[]): string[] {
  const total = v.on.length + v.off.length
  if (total === 0 || v.off.length * 2 <= total) return []
  return v.off.filter(f => !warned.includes(f))
}
