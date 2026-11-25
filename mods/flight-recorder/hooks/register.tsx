// FLIGHT RECORDER: the session's black box.
//  - Every turn and every tool call in it, with start, length, kind and outcome.
//  - Side panel: a waterfall of the last turns (hover a bar for details), totals,
//    the slowest calls and the failures.
//  - /recorder export writes the whole log as Markdown, ready for a PR or a retro.
//  - /recorder [show | export | stats | clear]
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Call, Flight, Turn } from '../types'
import { KIND_COLOR, KIND_ZH, clip, durOf, fmtMs, kindOf, labelOf, statsOf, toMarkdown, toolName, turnDur, waterfallSvg } from './view'

const PANE = 'flight-recorder'
const TITLE = 'FLIGHT RECORDER · 黑匣子'
const MAX_TURNS = 40
const MAX_CALLS = 200
const SHOWN_TURNS = 5

const EMPTY: Flight = { turns: [], nextN: 1 }
const flightAtom = atom({ plugin: 'flight-recorder', key: 'flight' } as const, EMPTY, { shape: 'flight-1' })

// The prompt the next turn answers; turn.start carries it too, this is the fallback.
let pendingPrompt = ''

async function edit($: EngineInterface, fn: (f: Flight) => Flight) {
  await update($, flightAtom, fn)
}

function openTurn(f: Flight, id: string, prompt: string, at: number): Flight {
  const turn: Turn = { n: f.nextN, id, prompt: clip(prompt, 400), start: at, calls: [] }
  return { nextN: f.nextN + 1, turns: [...f.turns, turn].slice(-MAX_TURNS) }
}

/** Applies `fn` to the newest turn, opening one when there is none or it has ended long ago. */
function onLast(f: Flight, at: number, fn: (t: Turn) => Turn): Flight {
  let flight = f
  const last = flight.turns[flight.turns.length - 1]
  if (!last || (last.end !== undefined && at - last.end > 5000)) flight = openTurn(flight, `implicit-${at}`, '', at)
  const turns = [...flight.turns]
  turns[turns.length - 1] = fn(turns[turns.length - 1]!)
  return { ...flight, turns }
}

function homeDir(home: string | undefined, cwd: string): string {
  return home ?? cwd
}

async function exportLog($: EngineInterface): Promise<string> {
  const flight = await read($, flightAtom)
  if (flight.turns.length === 0) return '还没有可以导出的记录。'
  const cwd = await $.session.cwd()
  const repo = cwd.split('/').filter(Boolean).pop() ?? 'session'
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  const path = `${homeDir(await $.env.get('HOME'), cwd)}/.claude/flight-recorder/${repo}-${stamp}.md`
  await $.fs.write(path, toMarkdown(flight, Date.now(), repo))
  $.ui.toast(`📼 飞行日志已导出：${path}`, { timeoutMs: 8000 })
  return `飞行日志已导出到 ${path}（${flight.turns.length} 轮）。`
}

async function clearLog($: EngineInterface): Promise<string> {
  await edit($, () => EMPTY)
  return '黑匣子已清空。'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'recorder',
      description: 'Flight recorder: /recorder show | export | stats | clear',
      argumentHint: 'show | export | stats | clear',
    })
    return next(e)
  })

  on('command.run', { command: 'recorder' }, async ($, e) => {
    const verb = e.args.trim().toLowerCase()
    if (verb === 'export') return { text: await exportLog($) }
    if (verb === 'clear') return { text: await clearLog($) }
    if (verb === 'stats') {
      const now = Date.now()
      const st = statsOf(await read($, flightAtom), now)
      return {
        text: [
          `${st.turns} 轮 · ${st.calls} 次工具调用 · ${st.fails} 次失败 · 轮次合计 ${fmtMs(st.totalMs)}`,
          `按类型：${st.byKind.map(([k, n]) => `${KIND_ZH[k]} ${n}`).join(' · ') || '—'}`,
          st.busiestTool ? `最常用：${toolName(st.busiestTool[0])} ×${st.busiestTool[1]}` : '',
          ...st.slowest.map((c, i) => `最慢 ${i + 1}：${toolName(c.tool)} ${fmtMs(durOf(c, now))} — ${c.label}`),
        ]
          .filter(Boolean)
          .join('\n'),
      }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: '黑匣子面板已打开。' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!e.isMeta && !e.command) pendingPrompt = e.text
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const prompt = e.text || pendingPrompt
      pendingPrompt = ''
      await edit($, f => openTurn(f, e.turnId, prompt, Date.now()))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) {
      const at = Date.now()
      await edit($, f => {
        const last = f.turns[f.turns.length - 1]
        if (!last || last.end !== undefined) return f
        const turns = [...f.turns]
        turns[turns.length - 1] = { ...last, end: at, ...(e.isAborted ? { isAborted: true } : {}) }
        return { ...f, turns }
      })
    }
    return r
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const start = Date.now()
    const call: Call = {
      id: e.tool_use_id || `${tool}-${start}`,
      tool,
      kind: kindOf(tool),
      label: labelOf(tool, e as unknown as Record<string, unknown>),
      start,
      status: 'run',
      ...(e.agentId !== undefined ? { isSub: true } : {}),
    }
    await edit($, f => onLast(f, start, t => ({ ...t, calls: [...t.calls, call].slice(-MAX_CALLS) })))
    let status: Call['status'] = 'err'
    try {
      const ran = await next(e)
      status = ran.deny !== undefined ? 'denied' : ran.isError === true ? 'err' : 'ok'
      return ran
    } finally {
      const end = Date.now()
      await edit($, f => ({
        ...f,
        turns: f.turns.map(t =>
          t.calls.some(c => c.id === call.id)
            ? { ...t, calls: t.calls.map(c => (c.id === call.id ? { ...c, end, status } : c)) }
            : t,
        ),
      }))
    }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const flight = await read($, flightAtom)
    const now = Date.now()
    const shown = flight.turns.slice(-SHOWN_TURNS)
    const st = statsOf(flight, now)
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const fails = flight.turns
      .flatMap(t => t.calls.filter(c => c.status === 'err' || c.status === 'denied').map(c => ({ c, n: t.n })))
      .slice(-3)

    const chart =
      e.surface !== 'terminal' && 'Svg' in els ? (
        <els.Svg
          source={waterfallSvg(shown, now, e.props.bodyColumns * 8)}
          alt={`最近 ${shown.length} 轮的工具调用瀑布图`}
          isInteractive
        />
      ) : (
        <Box flexDirection="column">
          {shown.length === 0 && <Text dimColor>还没有记录。发一条消息开始飞行。</Text>}
          {[...shown].reverse().map(t => (
            <Box flexDirection="column">
              <Text bold>
                #{t.n} · {fmtMs(turnDur(t, now))}
                {t.end ? '' : ' ⏵'} · {t.calls.length} 次调用 · {clip(t.prompt || '（无提示词）', 30)}
              </Text>
              {t.calls.slice(-6).map(c => (
                <Text color={c.status === 'err' || c.status === 'denied' ? '#FF4D4F' : KIND_COLOR[c.kind]}>
                  {'  '}
                  {c.status === 'run' ? '⏵' : c.status === 'ok' ? '▸' : '✗'} {toolName(c.tool)} {fmtMs(durOf(c, now))}{' '}
                  {clip(c.label, 36)}
                </Text>
              ))}
              {t.calls.length > 6 && <Text dimColor>{'  '}…还有 {t.calls.length - 6} 次</Text>}
            </Box>
          ))}
        </Box>
      )

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>
          {st.turns} 轮 · {st.calls} 次调用 · {st.fails} 次失败 · {fmtMs(st.totalMs)}
        </Text>
        {chart}
        {st.slowest.length > 0 && (
          <Box flexDirection="column">
            <Text bold>最慢的调用</Text>
            {st.slowest.map(c => (
              <Text dimColor>
                {fmtMs(durOf(c, now))} · {toolName(c.tool)} · {clip(c.label, 40)}
              </Text>
            ))}
          </Box>
        )}
        {fails.length > 0 && (
          <Box flexDirection="column">
            <Text bold color="#FF4D4F">
              失败
            </Text>
            {fails.map(({ c, n }) => (
              <Text color="#FF8A8A">
                #{n} · {toolName(c.tool)} · {clip(c.label, 40)}
              </Text>
            ))}
          </Box>
        )}
        <Box flexDirection="row" gap={1}>
          <Button key="export" label="导出 Markdown" variant="primary" onPress={() => exportLog($)} />
          <Button key="clear" label="清空" dimColor onPress={() => clearLog($)} />
        </Box>
      </Box>
    )
  })
}
