// What the recorder draws and exports: call labels, the waterfall SVG, stats and Markdown.
import type { Call, CallKind, Flight, Turn } from '../types'

export const KIND_COLOR: Record<CallKind, string> = {
  read: '#6EC6FF',
  write: '#7BD389',
  exec: '#FFB454',
  agent: '#B79CFF',
  web: '#FF8FB1',
  mcp: '#4FD1C5',
  other: '#A0A0B0',
}

export const KIND_ZH: Record<CallKind, string> = {
  read: '读',
  write: '写',
  exec: '执行',
  agent: '子代理',
  web: '网络',
  mcp: 'MCP',
  other: '其他',
}

const READ = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'ToolSearch', 'LSP', 'TaskList', 'TaskGet'])
const WRITE = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])
const EXEC = new Set(['Bash', 'PowerShell', 'BashOutput', 'KillShell', 'Monitor'])
const AGENT = new Set(['Agent', 'Task', 'SendMessage', 'Workflow'])
const WEB = new Set(['WebFetch', 'WebSearch'])

export function kindOf(tool: string): CallKind {
  if (READ.has(tool)) return 'read'
  if (WRITE.has(tool)) return 'write'
  if (EXEC.has(tool)) return 'exec'
  if (AGENT.has(tool)) return 'agent'
  if (WEB.has(tool)) return 'web'
  if (tool.startsWith('mcp__')) return 'mcp'
  return 'other'
}

export const clip = (s: string, n: number) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}

const base = (p: string) => p.split('/').filter(Boolean).pop() ?? p

/** One short line for a call, from the fields each tool takes. */
export function labelOf(tool: string, input: Record<string, unknown>): string {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : undefined)
  const path = s('file_path') ?? s('notebook_path') ?? s('path')
  if (tool === 'Bash' || tool === 'PowerShell') return clip(s('description') ?? s('command') ?? '', 60)
  if (path && (READ.has(tool) || WRITE.has(tool))) return base(path)
  if (tool === 'Grep' || tool === 'Glob') return clip(s('pattern') ?? '', 40)
  if (tool === 'WebFetch') return clip((s('url') ?? '').replace(/^https?:\/\//, ''), 50)
  if (tool === 'WebSearch') return clip(s('query') ?? '', 50)
  if (AGENT.has(tool)) return clip(s('description') ?? s('prompt') ?? '', 50)
  const first = Object.values(input).find((v): v is string => typeof v === 'string' && v.length > 0)
  return clip(first ?? '', 40)
}

export const toolName = (tool: string) => tool.replace(/^mcp__.*?__/, '')

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`
}

export const durOf = (c: Call, now: number) => (c.end ?? now) - c.start
export const turnDur = (t: Turn, now: number) => (t.end ?? now) - t.start

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Greedy lanes: a call goes in the first lane free at its start. */
function lanesOf(calls: Call[], now: number, max: number): number[] {
  const ends: number[] = []
  return calls.map(c => {
    let lane = ends.findIndex(e => e <= c.start)
    if (lane === -1) lane = ends.length < max ? ends.length : ends.indexOf(Math.min(...ends))
    ends[lane] = c.end ?? now
    return lane
  })
}

const LANE = 9
const MAX_LANES = 8

/** The waterfall of the last turns, newest at the top. */
export function waterfallSvg(turns: Turn[], now: number, width: number): string {
  const W = 320
  const pad = 10
  const span = W - pad * 2
  let y = 8
  const parts: string[] = []
  for (const t of [...turns].reverse()) {
    const dur = Math.max(1000, turnDur(t, now))
    const lanes = lanesOf(t.calls, now, MAX_LANES)
    const laneCount = Math.max(1, ...lanes.map(l => l + 1))
    const fails = t.calls.filter(c => c.status === 'err' || c.status === 'denied').length
    const head = `#${t.n} · ${fmtMs(dur)}${t.end ? '' : ' ⏵'} · ${t.calls.length} 次调用${fails ? ` · ${fails} 失败` : ''}`
    parts.push(
      `<text x="${pad}" y="${y + 10}" font-family="ui-monospace,monospace" font-size="10" font-weight="bold" fill="#E8E4F4">${esc(head)}</text>`,
      `<text x="${pad}" y="${y + 22}" font-family="ui-sans-serif,sans-serif" font-size="9.5" fill="#9C94B8">${esc(clip(t.prompt || '（无提示词）', 52))}</text>`,
    )
    y += 28
    const h = laneCount * LANE
    parts.push(`<rect x="${pad}" y="${y}" width="${span}" height="${h}" rx="2" fill="#1C1830"/>`)
    t.calls.forEach((c, i) => {
      const x = pad + ((c.start - t.start) / dur) * span
      const w = Math.max(2.5, (durOf(c, now) / dur) * span)
      const cy = y + lanes[i]! * LANE + 1
      const bad = c.status === 'err' || c.status === 'denied'
      parts.push(
        `<rect x="${x.toFixed(1)}" y="${cy}" width="${Math.min(w, pad + span - x).toFixed(1)}" height="${LANE - 2}" rx="1.5" fill="${KIND_COLOR[c.kind]}"${c.isSub ? ' fill-opacity=".55"' : ''}${bad ? ' stroke="#FF4D4F" stroke-width="1.5"' : ''}><title>${esc(`${toolName(c.tool)} · ${fmtMs(durOf(c, now))} · ${c.status === 'run' ? '运行中' : bad ? '失败' : '成功'}${c.isSub ? ' · 子代理' : ''}\n${c.label}`)}</title></rect>`,
      )
    })
    y += h + 14
  }
  if (turns.length === 0) {
    parts.push(
      `<text x="${W / 2}" y="40" text-anchor="middle" font-family="ui-sans-serif,sans-serif" font-size="11" fill="#9C94B8">还没有记录。发一条消息开始飞行。</text>`,
    )
    y = 64
  }
  // Legend.
  const kinds = Object.keys(KIND_COLOR) as CallKind[]
  kinds.forEach((k, i) => {
    const lx = pad + (i % 4) * 76
    const ly = y + Math.floor(i / 4) * 14
    parts.push(
      `<rect x="${lx}" y="${ly}" width="9" height="9" rx="2" fill="${KIND_COLOR[k]}"/><text x="${lx + 13}" y="${ly + 8}" font-family="ui-sans-serif,sans-serif" font-size="9" fill="#9C94B8">${KIND_ZH[k]}</text>`,
    )
  })
  y += 32
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${y}" width="${Math.min(width, 420)}"><rect width="${W}" height="${y}" rx="10" fill="#12101E"/>${parts.join('')}</svg>`
}

export type Stats = {
  turns: number
  calls: number
  fails: number
  byKind: Array<[CallKind, number]>
  slowest: Call[]
  busiestTool?: [string, number]
  totalMs: number
}

export function statsOf(flight: Flight, now: number): Stats {
  const calls = flight.turns.flatMap(t => t.calls)
  const counts = new Map<CallKind, number>()
  const tools = new Map<string, number>()
  for (const c of calls) {
    counts.set(c.kind, (counts.get(c.kind) ?? 0) + 1)
    tools.set(c.tool, (tools.get(c.tool) ?? 0) + 1)
  }
  const busiest = [...tools.entries()].sort((a, b) => b[1] - a[1])[0]
  return {
    turns: flight.turns.length,
    calls: calls.length,
    fails: calls.filter(c => c.status === 'err' || c.status === 'denied').length,
    byKind: [...counts.entries()].sort((a, b) => b[1] - a[1]),
    slowest: [...calls].sort((a, b) => durOf(b, now) - durOf(a, now)).slice(0, 3),
    ...(busiest ? { busiestTool: busiest } : {}),
    totalMs: flight.turns.reduce((n, t) => n + turnDur(t, now), 0),
  }
}

const STATUS_MD: Record<Call['status'], string> = { run: '⏵', ok: '✓', err: '✗', denied: '⊘' }

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

export function toMarkdown(flight: Flight, now: number, where: string): string {
  const st = statsOf(flight, now)
  const stamp = new Date(now).toISOString().replace('T', ' ').slice(0, 16)
  const lines = [
    `# Flight log · ${where}`,
    '',
    `${stamp} · ${st.turns} turns · ${st.calls} tool calls · ${st.fails} failed · ${fmtMs(st.totalMs)} in turns`,
    '',
    `By kind: ${st.byKind.map(([k, n]) => `${k} ${n}`).join(' · ') || '—'}`,
    '',
  ]
  if (st.slowest.length) {
    lines.push('Slowest calls:', '')
    for (const c of st.slowest) lines.push(`- ${toolName(c.tool)} ${fmtMs(durOf(c, now))} — ${cell(c.label)}`)
    lines.push('')
  }
  for (const t of flight.turns) {
    lines.push(
      `## Turn ${t.n} · ${fmtMs(turnDur(t, now))}${t.isAborted ? ' · interrupted' : ''}`,
      '',
      `> ${cell(clip(t.prompt || '(no prompt)', 300))}`,
      '',
    )
    if (t.calls.length === 0) {
      lines.push('No tool calls.', '')
      continue
    }
    lines.push('| t+ | Tool | Took | | What |', '| --: | --- | --: | :-: | --- |')
    for (const c of t.calls) {
      lines.push(
        `| ${fmtMs(c.start - t.start)} | ${toolName(c.tool)}${c.isSub ? ' (sub)' : ''} | ${fmtMs(durOf(c, now))} | ${STATUS_MD[c.status]} | ${cell(c.label)} |`,
      )
    }
    lines.push('')
  }
  return lines.join('\n')
}
