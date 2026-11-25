// TOKEN GARDEN: the context window as a garden in the side panel.
//  - Each main-loop turn plants one plant, by what the turn mostly did:
//    reads → grass, edits → flowers, commands → trees, subagents → mushrooms,
//    the web → vines, no tools → a sprout.
//  - As the context fills the garden goes from lush (under 50%) to dry (50-80%)
//    to wilted (80% and up). At 80% a toast suggests /compact or a new session, once.
//  - A compaction or /clear replants the garden.
//  - /garden [show | replant]
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Garden, PlantKind } from '../types'
import { HEALTH_ZH, KIND_ZH, barText, gardenSvg, glyphOf, healthOf } from './garden'

const PANE = 'token-garden'
const TITLE = 'TOKEN GARDEN · 上下文花园'
const MAX_PLANTS = 60
const WARN_PCT = 80

const EMPTY: Garden = { plants: [], pct: 0, tokens: 0, window: 0, turns: 0, replants: 0, isWarned: false }
const gardenAtom = atom({ plugin: 'token-garden', key: 'garden' } as const, EMPTY, { shape: 'garden-1' })

const READ = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'ToolSearch', 'LSP'])
const WRITE = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])
const EXEC = new Set(['Bash', 'PowerShell', 'Monitor'])
const AGENT = new Set(['Agent', 'Task', 'SendMessage', 'Workflow'])
const WEB = new Set(['WebFetch', 'WebSearch'])

export function kindOfTool(tool: string): PlantKind | undefined {
  if (READ.has(tool)) return 'grass'
  if (WRITE.has(tool)) return 'flower'
  if (EXEC.has(tool)) return 'tree'
  if (AGENT.has(tool)) return 'mushroom'
  if (WEB.has(tool) || tool.startsWith('mcp__')) return 'vine'
  return undefined
}

/** The kind a turn grows: the most frequent of its calls, ties to the rarer kind. */
export function kindOfTurn(counts: Partial<Record<PlantKind, number>>): PlantKind {
  const order: PlantKind[] = ['mushroom', 'vine', 'tree', 'flower', 'grass']
  let best: PlantKind = 'sprout'
  let n = 0
  for (const k of order) {
    const c = counts[k] ?? 0
    if (c > n) {
      best = k
      n = c
    }
  }
  return best
}

// This turn's calls, by the kind they grow. A reload starts them over.
let counts: Partial<Record<PlantKind, number>> = {}

async function measure($: EngineInterface) {
  const { context } = await $.session.usage()
  const pct = Math.max(0, Math.min(100, Math.round(context.percent ?? 0)))
  const next = await update($, gardenAtom, g => ({ ...g, pct, tokens: context.tokens ?? 0, window: context.window ?? 0 }))
  if (next.pct >= WARN_PCT && !next.isWarned) {
    await update($, gardenAtom, g => ({ ...g, isWarned: true }))
    $.ui.toast(`🥀 花园快枯了：上下文已用 ${next.pct}%。试试 /compact 压缩一下，或者开个新会话。`, { timeoutMs: 10000 })
    void $.ui.open({ id: PANE, title: TITLE })
  }
}

async function replant($: EngineInterface, why: string) {
  counts = {}
  await update($, gardenAtom, g => ({ ...EMPTY, replants: g.replants + 1 }))
  $.ui.toast(`🌱 ${why}，花园重新翻土了。`, { timeoutMs: 5000 })
  await measure($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'garden',
      description: 'Token garden of the context window: /garden show | replant',
      argumentHint: 'show | replant',
    })
    await measure($)
    $.clock.every(30_000, () => {
      void measure($)
    })
    return next(e)
  })

  on('command.run', { command: 'garden' }, async ($, e) => {
    if (e.args.trim().toLowerCase() === 'replant') {
      await replant($, '手动重来')
      return { text: '花园已重新翻土。' }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    await measure($)
    return { text: '上下文花园已打开。' }
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      const kind = kindOfTool(String(e.tool))
      if (kind) counts = { ...counts, [kind]: (counts[kind] ?? 0) + 1 }
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) {
      const kind = kindOfTurn(counts)
      counts = {}
      const at = Date.now()
      await update($, gardenAtom, g => ({
        ...g,
        turns: g.turns + 1,
        plants: [...g.plants, { kind, turn: g.turns + 1, at, seed: (at ^ (g.turns * 2654435761)) >>> 0 }].slice(-MAX_PLANTS),
      }))
      await measure($)
    }
    return r
  })

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && e.trigger !== 'precompute' && !('skip' in r && r.skip)) await replant($, '上下文压缩完成')
    return r
  }).catch(($, e, next) => next(e))

  on('session.end', async ($, e, next) => {
    const r = await next(e)
    if (e.reason === 'clear') await replant($, '/clear 清空了对话')
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const g = await read($, gardenAtom)
    const health = healthOf(g.pct)
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const tally = (Object.keys(KIND_ZH) as PlantKind[])
      .map(k => [k, g.plants.filter(p => p.kind === k).length] as const)
      .filter(([, n]) => n > 0)

    return (
      <Box flexDirection="column" gap={1}>
        {e.surface !== 'terminal' && 'Svg' in els ? (
          <els.Svg
            source={gardenSvg(g, e.props.bodyColumns * 8)}
            alt={`上下文花园：${g.plants.length} 株植物，${HEALTH_ZH[health]}，上下文 ${g.pct}%`}
          />
        ) : (
          <Box flexDirection="column">
            <Text>{g.plants.length ? g.plants.slice(-30).map(p => glyphOf(p.kind, health)).join('') : '（刚翻过土）'}</Text>
          </Box>
        )}
        <Text color={health === 'wilted' ? '#C0392B' : health === 'dry' ? '#E0A030' : '#3FA34D'}>
          上下文 {barText(g.pct)} {g.pct}% · {HEALTH_ZH[health]}
        </Text>
        <Text dimColor>
          {g.turns} 轮 · {tally.map(([k, n]) => `${KIND_ZH[k]} ${n}`).join(' · ') || '还没有植物'}
          {g.replants ? ` · 已重种 ${g.replants} 次` : ''}
        </Text>
        {health === 'wilted' && <Text color="#C0392B">快满了：/compact 压缩上下文，或开一个新会话。</Text>}
        <Button key="replant" label="重新翻土" dimColor onPress={() => replant($, '手动重来')} />
      </Box>
    )
  })
}
