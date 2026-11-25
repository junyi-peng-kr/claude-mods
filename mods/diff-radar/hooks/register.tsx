// DIFF RADAR: the working tree as a radar scope.
//  - After edits, git commands and each turn, reads `git diff --numstat HEAD`
//    and the untracked files; each changed file is a blip.
//  - Counts how often Claude edits each file this session; a file edited
//    `threshold` times (5 by default) glows magenta and raises a churn warning,
//    again at every further multiple.
//  - /radar [show | scan | reset | threshold <n>]
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Change, Radar } from '../types'
import { C, HEAT_COLOR, HEAT_GLYPH, base, blipsOf, scopeSvg } from './scope'

const PANE = 'diff-radar'
const TITLE = 'DIFF RADAR · 改动雷达'
const STORE_THRESHOLD = 'diff-radar.threshold'
const DEFAULT_THRESHOLD = 5
const SCAN_DELAY_MS = 1200
const MAX_UNTRACKED_READ = 40

const EMPTY: Radar = { root: '', branch: '', changes: [], edits: {}, scannedAt: 0, threshold: DEFAULT_THRESHOLD }
const radarAtom = atom({ plugin: 'diff-radar', key: 'radar' } as const, EMPTY, { shape: 'radar-1' })

const FILE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])
const GIT_MOVES_RE = /(^|[\s;&|(])git\s+(commit|checkout|switch|reset|restore|stash|merge|pull|rebase|cherry-pick|revert|add|rm|mv|apply|am)\b/

let isScanQueued = false

async function git($: EngineInterface, args: string[]): Promise<string | undefined> {
  try {
    const r = await $.process.run(['git', ...args], { timeoutMs: 6000 })
    return r.exitCode === 0 ? r.stdout : undefined
  } catch {
    return undefined
  }
}

/** `12\t3\tsrc/a.ts` rows; a rename is `old => new` or `dir/{old => new}/f`. */
export function parseNumstat(out: string): Change[] {
  return out
    .split('\n')
    .filter(Boolean)
    .flatMap(row => {
      const [a, d, ...rest] = row.split('\t')
      let path = rest.join('\t')
      if (!path) return []
      path = path.replace(/\{[^{}]*? => ([^{}]*)\}/, '$1').replace(/^.* => /, '').replace(/\/\//g, '/')
      return [{ path, add: Number(a) || 0, del: Number(d) || 0 }]
    })
}

async function scan($: EngineInterface) {
  const top = (await git($, ['rev-parse', '--show-toplevel']))?.trim()
  if (!top) {
    await update($, radarAtom, r => ({ ...r, root: '', branch: '', changes: [], scannedAt: Date.now() }))
    return
  }
  const branch = (await git($, ['rev-parse', '--abbrev-ref', 'HEAD']))?.trim() ?? ''
  const diff = (await git($, ['-C', top, 'diff', '--numstat', 'HEAD', '--'])) ?? (await git($, ['-C', top, 'diff', '--numstat', '--'])) ?? ''
  const changes = parseNumstat(diff)
  const untracked = ((await git($, ['-C', top, 'ls-files', '--others', '--exclude-standard'])) ?? '')
    .split('\n')
    .filter(Boolean)
    .slice(0, 200)
  for (const [i, path] of untracked.entries()) {
    let add = 0
    if (i < MAX_UNTRACKED_READ) {
      try {
        const text = await $.fs.read(`${top}/${path}`, { length: 512 * 1024 })
        add = text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
      } catch {
        add = 0
      }
    }
    changes.push({ path, add, del: 0, isNew: true })
  }
  await update($, radarAtom, r => ({ ...r, root: top, branch, changes, scannedAt: Date.now() }))
}

function queueScan($: EngineInterface) {
  if (isScanQueued) return
  isScanQueued = true
  $.clock.after(SCAN_DELAY_MS, () => {
    isScanQueued = false
    void scan($)
  })
}

/** The repository root, asked of git once it is known; '' outside a repository. */
async function rootOf($: EngineInterface): Promise<string> {
  const known = (await read($, radarAtom)).root
  if (known) return known
  const top = (await git($, ['rev-parse', '--show-toplevel']))?.trim() ?? ''
  if (top) await update($, radarAtom, r => ({ ...r, root: top }))
  return top
}

const relative = (root: string, path: string) => (root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path)

async function resetCounts($: EngineInterface): Promise<string> {
  await update($, radarAtom, r => ({ ...r, edits: {} }))
  return '已把本次会话的改动计数清零。'
}

async function rescan($: EngineInterface): Promise<string> {
  await scan($)
  const r = await read($, radarAtom)
  return r.root ? `扫描完成：${r.changes.length} 个文件有改动。` : '当前目录不在 git 仓库里。'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'radar',
      description: 'Diff radar of the working tree: /radar show | scan | reset | threshold <n>',
      argumentHint: 'show | scan | reset | threshold <n>',
    })
    const saved = Number(await $.store.get(STORE_THRESHOLD))
    const threshold = Number.isInteger(saved) && saved >= 2 ? saved : DEFAULT_THRESHOLD
    await update($, radarAtom, r => ({ ...r, threshold }))
    void scan($)
    return next(e)
  })

  on('command.run', { command: 'radar' }, async ($, e) => {
    const [verb = 'show', arg] = e.args.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (verb === 'scan') return { text: await rescan($) }
    if (verb === 'reset') return { text: await resetCounts($) }
    if (verb === 'threshold') {
      const n = Number(arg)
      if (!Number.isInteger(n) || n < 2 || n > 50) return { text: '用法：/radar threshold <2 到 50 的整数>' }
      await update($, radarAtom, r => ({ ...r, threshold: n }))
      await $.store.set(STORE_THRESHOLD, n)
      return { text: `同一个文件被改 ${n} 次就算原地打转。` }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    void scan($)
    return { text: '改动雷达已打开。' }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    const tool = String(e.tool)
    if (FILE_TOOLS.has(tool)) {
      const input = e as unknown as { file_path?: unknown; notebook_path?: unknown }
      const abs = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : ''
      if (abs) {
        const path = relative(await rootOf($), abs)
        const now = Date.now()
        const after = await update($, radarAtom, r => {
          const cur = r.edits[path] ?? { count: 0, last: 0 }
          return { ...r, edits: { ...r.edits, [path]: { count: cur.count + 1, last: now } } }
        })
        const count = after.edits[path]?.count ?? 0
        if (count >= after.threshold && count % after.threshold === 0) {
          $.ui.toast(`🎯 ${base(path)} 已经被改了 ${count} 次，是不是在原地打转？换个思路，或者先停下来理一理。`, {
            timeoutMs: 9000,
          })
          void $.ui.open({ id: PANE, title: TITLE })
        }
      }
      queueScan($)
    } else if (tool === 'Bash' && GIT_MOVES_RE.test((e as unknown as { command: string }).command)) {
      queueScan($)
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) queueScan($)
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const radar = await read($, radarAtom)
    const now = Date.now()
    const blips = blipsOf(radar)
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const add = radar.changes.reduce((n, c) => n + c.add, 0)
    const del = radar.changes.reduce((n, c) => n + c.del, 0)
    const hot = blips.filter(b => b.heat === 'hot')

    return (
      <Box flexDirection="column" gap={1}>
        {e.surface !== 'terminal' && 'Svg' in els ? (
          <els.Svg
            source={scopeSvg(radar, now, e.props.bodyColumns * 8)}
            alt={`改动雷达：${blips.length} 个文件有改动，+${add} −${del}，${hot.length} 个文件被反复修改`}
            isInteractive
          />
        ) : (
          <Text bold color={C.cyan}>
            DIFF RADAR · {blips.length} 个文件 · +{add} −{del}
            {hot.length ? ` · ${hot.length} 个过热` : ''}
          </Text>
        )}
        {hot.length > 0 && (
          <Text color={C.magenta} bold>
            ⚠ 反复修改：{hot.map(b => `${base(b.path)} ×${b.edits}`).join('、')}
          </Text>
        )}
        <Box flexDirection="column">
          {blips.length === 0 && <Text dimColor>{radar.root ? '工作区干净，没有改动。' : '当前目录不在 git 仓库里。'}</Text>}
          {blips.slice(0, 12).map(b => (
            <Text color={HEAT_COLOR[b.heat]}>
              {HEAT_GLYPH[b.heat]} {b.path.length > 42 ? `…${b.path.slice(-41)}` : b.path}
              {b.isNew ? ' (新)' : ''} +{b.add} −{b.del}
              {b.edits ? ` · 改 ${b.edits} 次` : ''}
            </Text>
          ))}
          {blips.length > 12 && <Text dimColor>…还有 {blips.length - 12} 个文件</Text>}
        </Box>
        <Text dimColor>
          {radar.branch ? `${radar.branch} · ` : ''}
          {radar.scannedAt ? `扫描于 ${new Date(radar.scannedAt).toTimeString().slice(0, 8)}` : '扫描中…'} · 改 {radar.threshold}{' '}
          次算过热
        </Text>
        <Box flexDirection="row" gap={1}>
          <Button key="scan" label="重新扫描" onPress={() => rescan($)} />
          <Button key="reset" label="计数清零" dimColor onPress={() => resetCounts($)} />
        </Box>
      </Box>
    )
  })
}
