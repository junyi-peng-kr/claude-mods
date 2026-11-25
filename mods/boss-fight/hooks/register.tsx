// BOSS FIGHT: failing tests become a boss, and fixing them is the fight.
//  - A test run with failures summons a boss; its HP is the number of failures.
//  - Every later test run is a round: fewer failures deal damage, more heal it.
//  - The first fully green run defeats it, with the time, rounds and actions it took.
//  - Records (wins, fastest kill, recent bosses) are kept across sessions.
//  - /boss [show | flee | stats | demo]
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Battle, LogKind, Records, Win } from '../types'
import { KINDS, TIER_ZH, bossSvg, fmtMs, hpBar, tierOf } from './art'
import { TEST_RE, firstFailure, hash, parseRun } from './parse'

const PANE = 'boss-fight'
const TITLE = 'BOSS FIGHT · 打怪'
const STORE_RECORDS = 'boss-fight.records'
const STORE_BATTLE = 'boss-fight.battle'

const IDLE: Battle = { status: 'idle', boss: null, startedAt: 0, endedAt: 0, rounds: 0, actions: 0, log: [], hitId: 0 }
const NO_RECORDS: Records = { wins: 0, flees: 0, damage: 0, fastestMs: 0, recent: [] }

const battleAtom = atom({ plugin: 'boss-fight', key: 'battle' } as const, IDLE, { shape: 'battle-1' })
const recordsAtom = atom({ plugin: 'boss-fight', key: 'records' } as const, NO_RECORDS, { shape: 'records-1' })

const line = (kind: LogKind, text: string) => ({ at: Date.now(), kind, text })

async function setBattle($: EngineInterface, fn: (b: Battle) => Battle) {
  const next = fn(await read($, battleAtom))
  await update($, battleAtom, () => next)
  // A fight in progress survives a restart of the session.
  await $.store.set(STORE_BATTLE, next.status === 'fighting' ? next : null)
  return next
}

async function setRecords($: EngineInterface, fn: (r: Records) => Records) {
  const next = fn(await read($, recordsAtom))
  await update($, recordsAtom, () => next)
  await $.store.set(STORE_RECORDS, next)
}

/** One test run's outcome applied to the battle. */
async function round($: EngineInterface, failed: number, passed: number, name: string) {
  const b = await read($, battleAtom)
  const now = Date.now()

  if (b.status !== 'fighting') {
    if (failed === 0) return
    const seed = hash(name)
    const kind = KINDS[seed % KINDS.length]!
    const tier = tierOf(failed)
    const boss = { name, kind, tier, maxHp: failed, hp: failed, seed }
    await setBattle($, () => ({
      status: 'fighting',
      boss,
      startedAt: now,
      endedAt: 0,
      rounds: 1,
      actions: 0,
      hitId: 0,
      log: [line('spawn', `${TIER_ZH[tier]}「${name}」${kind} 出现了！HP ${failed}`)],
    }))
    $.ui.toast(`⚔️ ${TIER_ZH[tier]}出现：${kind}「${name}」· HP ${failed}`, { timeoutMs: 6000 })
    void $.ui.open({ id: PANE, title: TITLE })
    return
  }

  const boss = b.boss!
  if (failed === 0) {
    const ms = now - b.startedAt
    const win: Win = { name: boss.name, kind: boss.kind, maxHp: boss.maxHp, rounds: b.rounds + 1, ms, at: now }
    await setBattle($, cur => ({
      ...cur,
      status: 'won',
      endedAt: now,
      rounds: cur.rounds + 1,
      hitId: cur.hitId + 1,
      boss: { ...boss, hp: 0 },
      log: [...cur.log, line('win', `最后一击！${boss.kind} 倒下了${passed ? `（${passed} 项全绿）` : ''}`)].slice(-30),
    }))
    const records = await read($, recordsAtom)
    const isRecord = records.fastestMs === 0 || ms < records.fastestMs
    await setRecords($, r => ({
      ...r,
      wins: r.wins + 1,
      damage: r.damage + boss.hp,
      fastestMs: isRecord ? ms : r.fastestMs,
      recent: [win, ...r.recent].slice(0, 10),
    }))
    $.ui.toast(
      `🏆 击败 ${boss.kind}「${boss.name}」！用时 ${fmtMs(ms)} · ${win.rounds} 回合${isRecord ? ' · 新纪录！' : ''}`,
      { timeoutMs: 8000 },
    )
    return
  }

  const dmg = boss.hp - failed
  const text =
    dmg > 0
      ? `第 ${b.rounds + 1} 回合：造成 ${dmg} 点伤害！剩余 HP ${failed}`
      : dmg < 0
        ? `第 ${b.rounds + 1} 回合：${boss.kind} 回血 +${-dmg}！HP ${failed}`
        : `第 ${b.rounds + 1} 回合：攻击落空，HP 仍是 ${failed}`
  await setBattle($, cur => ({
    ...cur,
    rounds: cur.rounds + 1,
    hitId: dmg > 0 ? cur.hitId + 1 : cur.hitId,
    boss: { ...boss, hp: failed, maxHp: Math.max(boss.maxHp, failed), tier: tierOf(Math.max(boss.maxHp, failed)) },
    log: [...cur.log, line(dmg > 0 ? 'hit' : dmg < 0 ? 'heal' : 'miss', text)].slice(-30),
  }))
  if (dmg > 0) await setRecords($, r => ({ ...r, damage: r.damage + dmg }))
}

async function flee($: EngineInterface): Promise<string> {
  const b = await read($, battleAtom)
  if (b.status !== 'fighting' || !b.boss) return '现在没有在打 Boss。'
  const boss = b.boss
  await setBattle($, cur => ({
    ...cur,
    status: 'fled',
    endedAt: Date.now(),
    log: [...cur.log, line('flee', `你从 ${boss.kind} 面前撤退了`)].slice(-30),
  }))
  await setRecords($, r => ({ ...r, flees: r.flees + 1 }))
  return `已从「${boss.name}」撤退。下次测试失败时会出现新的 Boss。`
}

const LOG_COLOR: Record<LogKind, string> = {
  spawn: '#FF9F43',
  hit: '#7BD389',
  heal: '#E84A5F',
  miss: '#B1A4CC',
  win: '#FFD84A',
  flee: '#B1A4CC',
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'boss',
      description: 'Failing tests as a boss fight: /boss show | flee | stats | demo',
      argumentHint: 'show | flee | stats | demo',
    })
    const records = (await $.store.get(STORE_RECORDS)) as Records | undefined
    if (records) await update($, recordsAtom, () => ({ ...NO_RECORDS, ...records }))
    const saved = (await $.store.get(STORE_BATTLE)) as Battle | null | undefined
    if (saved && saved.status === 'fighting' && saved.boss) {
      await update($, battleAtom, () => ({ ...saved, hitId: 0 }))
      void $.ui.open({ id: PANE, title: TITLE })
      $.ui.toast(`⚔️ ${saved.boss.kind}「${saved.boss.name}」还在等你 · HP ${saved.boss.hp}`)
    }
    return next(e)
  })

  on('command.run', { command: 'boss' }, async ($, e) => {
    const verb = e.args.trim().toLowerCase()
    if (verb === 'flee') return { text: await flee($) }
    if (verb === 'stats') {
      const r = await read($, recordsAtom)
      const recent = r.recent
        .slice(0, 5)
        .map(w => `  · ${w.kind}「${w.name}」HP ${w.maxHp} · ${w.rounds} 回合 · ${fmtMs(w.ms)}`)
        .join('\n')
      return {
        text: [
          `击败 ${r.wins} 个 Boss · 撤退 ${r.flees} 次 · 累计伤害 ${r.damage}`,
          `最快击杀 ${r.fastestMs ? fmtMs(r.fastestMs) : '—'}`,
          recent ? `最近的战绩：\n${recent}` : '还没有战绩。',
        ].join('\n'),
      }
    }
    if (verb === 'demo') {
      await $.ui.open({ id: PANE, title: TITLE })
      const runs = [5, 3, 4, 1, 0]
      runs.forEach((failed, i) =>
        $.clock.after(1 + i * 2200, () => void round($, failed, 12 - failed, 'demo › login flow')),
      )
      return { text: '演示：HP 5 的 Boss 出现 → 伤害 2 → 回血 1 → 伤害 3 → 击败。' }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'BOSS FIGHT 面板已打开。' }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) return ran
    const b = await read($, battleAtom)
    if (b.status === 'fighting') await update($, battleAtom, cur => ({ ...cur, actions: cur.actions + 1 }))
    if (e.tool !== 'Bash' || ran.deny !== undefined || !TEST_RE.test(e.command)) return ran
    const text = ran.text ?? ''
    const { failed, passed } = parseRun(text, ran.isError === true)
    const name = firstFailure(text) ?? e.command.trim().split(/\s+/).slice(0, 3).join(' ')
    await round($, failed, passed, name)
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const b = await read($, battleAtom)
    const r = await read($, recordsAtom)
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const boss = b.boss
    const now = Date.now()
    const elapsed = b.status === 'fighting' ? now - b.startedAt : b.endedAt - b.startedAt
    const alt = boss
      ? `${boss.kind}「${boss.name}」HP ${boss.hp}/${boss.maxHp}${b.status === 'won' ? '，已击败' : ''}`
      : '没有 Boss'

    return (
      <Box flexDirection="column" gap={1}>
        {e.surface !== 'terminal' && 'Svg' in els ? (
          <els.Svg source={bossSvg(b, e.props.bodyColumns * 8, now)} alt={alt} isInteractive />
        ) : boss ? (
          <Text bold color={b.status === 'won' ? '#FFD84A' : '#E84A5F'}>
            {b.status === 'won' ? '🏆 VICTORY' : '👾'} HP {hpBar(boss)} {boss.hp}/{boss.maxHp}
          </Text>
        ) : (
          <Text color="#7BD389">✓ 一片和平 · 没有 Boss</Text>
        )}
        {boss ? (
          <Box flexDirection="column">
            <Text bold>
              {TIER_ZH[boss.tier]} · {boss.kind}「{boss.name}」
            </Text>
            <Text dimColor>
              {b.status === 'won' ? '已击败' : b.status === 'fled' ? '已撤退' : '战斗中'} · {b.rounds} 回合 · {b.actions}{' '}
              次行动 · {fmtMs(elapsed)}
            </Text>
          </Box>
        ) : (
          <Text dimColor>测试一失败，Boss 就会出现。HP = 失败的用例数。</Text>
        )}
        {b.log.length > 0 && (
          <Box flexDirection="column">
            {b.log.slice(-6).map(l => (
              <Text color={LOG_COLOR[l.kind]}>› {l.text}</Text>
            ))}
          </Box>
        )}
        {b.status === 'fighting' && <Button key="flee" label="撤退" dimColor onPress={() => flee($)} />}
        <Text dimColor>
          战绩：击败 {r.wins} · 最快 {r.fastestMs ? fmtMs(r.fastestMs) : '—'} · 累计伤害 {r.damage}
        </Text>
      </Box>
    )
  })
}
