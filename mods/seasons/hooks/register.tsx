// SEASONS 四时: a look that follows the real season and the time of day.
//  - Spring 樱 (March to May), summer 萤, autumn 枫, winter 雪; day from 06:00 to 18:00.
//  - Each season has its palette in light and dark, and a slow scene by day and by
//    night: falling petals, drifting seeds or fireflies, maple leaves, snow.
//  - Checked every hour; the look is set again only when the season or time changes.
//  - /seasons on | off | auto | preview <spring|summer|autumn|winter> [day|night]
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Season, SeasonView, TimeOfDay } from '../types'
import { SEASON_ZH, TIME_ZH, colorsOf, lookOf, parseSceneId, sceneSvg, seasonOf, timeOf } from './four'

const STORE_ON = 'seasons.isOn'
const HOUR_MS = 60 * 60 * 1000
const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

const viewAtom = atom({ plugin: 'seasons', key: 'view' } as const, null, { shape: 'view-1' })
const isOnAtom = atom({ plugin: 'seasons', key: 'isOn' } as const, true)

const nameOf = (v: SeasonView) => `${SEASON_ZH[v.season]} · ${TIME_ZH[v.time]}`

async function show($: EngineInterface, view: SeasonView): Promise<string> {
  const unpainted = colorsOf(view.season).problems.find(line => line.startsWith("Desktop won't paint"))
  if (unpainted !== undefined) $.ui.log(`SEASONS: ${unpainted}`, { to: 'debug' })
  await update($, viewAtom, () => view)
  const set = await $.theme.set(lookOf(view.season, view.time))
  return set.isDrawn ? 'drawn' : set.reason
}

/** Sets the look for now, unless it already shows now or a preview holds it. */
async function follow($: EngineInterface, isForced: boolean): Promise<string | undefined> {
  if (!(await read($, isOnAtom))) return undefined
  const cur = await read($, viewAtom)
  if (cur?.isPreview && !isForced) return undefined
  const now = new Date()
  const next: SeasonView = { season: seasonOf(now), time: timeOf(now), isPreview: false }
  if (!isForced && cur && cur.season === next.season && cur.time === next.time && !cur.isPreview) return undefined
  return show($, next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const isOn = (await $.store.get(STORE_ON)) !== false
    await update($, isOnAtom, () => isOn)
    await $.command.register({
      name: 'seasons',
      description: 'SEASONS 四时 look: /seasons on | off | auto | preview <spring|summer|autumn|winter> [day|night]',
      argumentHint: 'on | off | auto | preview <season> [day|night]',
    })
    if (isOn) {
      const cur = await read($, viewAtom)
      const result = cur?.isPreview ? await show($, cur) : await follow($, true)
      if (result && result !== 'drawn') $.ui.log(`SEASONS: ${result}`, { to: 'debug' })
    }
    $.clock.every(HOUR_MS, () => {
      void follow($, false)
    })
    return next(e)
  })

  on('command.run', { command: 'seasons' }, async ($, e) => {
    const [verb = 'on', a, b] = e.args.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (verb === 'off') {
      await update($, isOnAtom, () => false)
      await $.store.set(STORE_ON, false)
      await $.theme.clear()
      return { text: '四时已关闭。/seasons on 重新开启。' }
    }
    await update($, isOnAtom, () => true)
    await $.store.set(STORE_ON, true)
    if (verb === 'preview') {
      if (!SEASONS.includes(a as Season) || (b !== undefined && b !== 'day' && b !== 'night')) {
        return { text: '用法：/seasons preview <spring|summer|autumn|winter> [day|night]' }
      }
      const view: SeasonView = { season: a as Season, time: (b as TimeOfDay | undefined) ?? 'day', isPreview: true }
      const result = await show($, view)
      return { text: `预览：${nameOf(view)}（${result}）。/seasons auto 回到跟随真实季节和时间。` }
    }
    const result = await follow($, true)
    const view = await read($, viewAtom)
    return {
      text: `四时：${view ? nameOf(view) : '—'}（${result ?? 'drawn'}），每小时跟随真实季节与昼夜变化。同一时间只有一个外观生效：如果别的外观 mod 开着，先关掉它。`,
    }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== $.plugin.name) return next(e)
    const which = parseSceneId(e.props.scene)
    if (!which || (e.surface !== 'desktop' && e.surface !== 'mobile')) return next(e)
    const { Svg } = $.ui.resolve(e)
    return (
      <Svg
        source={sceneSvg(which.season, which.time)}
        alt={`${SEASON_ZH[which.season]}，${TIME_ZH[which.time]}：缓缓飘落的季节景色`}
        isInteractive
      />
    )
  })
}
