// INK & PAPER 水墨书斋: a look for both modes.
//  - Light: rice paper. Dark: lamp-lit ink, its own version, not an inversion.
//  - Backdrop: an ink-wash landscape with slow mist.
//  - Your messages carry a vermilion seal at the corner; replies are paper slips.
//  - Status line: the solar term (节气) and the double hour (时辰), e.g. 小雪 · 未时.
//  - A passing test run stamps a 「准」 seal.
//  - /ink on | off
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { SCENE, SCENE_ID, colorsOf, lookOf, lookWithoutStyle, statusOf } from './paper'
import { otherLooksOn } from './looks'

const STORE_ON = 'ink-paper.isOn'
const isOnAtom = atom({ plugin: 'ink-paper', key: 'isOn' } as const, false)

const TEST_RE =
  /(^|[\s;&|(])((npm|pnpm|yarn|bun)\s+(run\s+)?test\b|npx\s+(jest|vitest|mocha|playwright)\b|(jest|vitest|pytest|mocha|rspec|phpunit)\b|go\s+test\b|cargo\s+(test|nextest)\b|python3?\s+-m\s+(pytest|unittest)\b|make\s+test\b|deno\s+test\b|swift\s+test\b|mvn\s+test\b|gradle\w*\s+test\b)/
const FAIL_RE = /\b[1-9]\d*\s+(failed|failing|failures?)\b|\bFAIL(ED)?\b|Tests?:\s+[1-9]\d*\s+failed/

async function applyLook($: EngineInterface): Promise<string> {
  const unpainted = colorsOf().problems.find(line => line.startsWith("Desktop won't paint"))
  if (unpainted !== undefined) $.ui.log(`INK & PAPER: ${unpainted}`, { to: 'debug' })
  try {
    const set = await $.theme.set(lookOf())
    return set.isDrawn ? 'drawn' : set.reason
  } catch (error) {
    // A build without `style` refuses the whole set: try again without it.
    $.ui.log(`INK & PAPER: ${String(error)}`, { to: 'debug' })
    const set = await $.theme.set(lookWithoutStyle())
    return set.isDrawn ? 'drawn (without message style)' : set.reason
  }
}

async function tickStatus($: EngineInterface) {
  $.ui.status((await read($, isOnAtom)) ? statusOf(new Date()) : undefined)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Off until you turn it on: only one look shows at a time.
    const isOn = (await $.store.get(STORE_ON)) === true
    await update($, isOnAtom, () => isOn)
    await $.command.register({
      name: 'ink',
      description: 'INK & PAPER 水墨书斋 look: /ink on | off',
      argumentHint: 'on | off',
    })
    if (isOn) {
      const result = await applyLook($)
      if (!result.startsWith('drawn')) $.ui.log(`INK & PAPER: ${result}`, { to: 'debug' })
    }
    await tickStatus($)
    // The double hour changes every two hours: look every ten minutes.
    $.clock.every(10 * 60 * 1000, () => {
      void tickStatus($)
    })
    return next(e)
  })

  on('command.run', { command: 'ink' }, async ($, e) => {
    if (e.args.trim().toLowerCase() === 'off') {
      await update($, isOnAtom, () => false)
      await $.store.set(STORE_ON, false)
      await $.theme.clear()
      $.ui.status(undefined)
      return { text: '水墨书斋已收起。/ink on 重新铺纸研墨。' }
    }
    await update($, isOnAtom, () => true)
    await $.store.set(STORE_ON, true)
    const result = await applyLook($)
    await tickStatus($)
    return {
      text: `水墨书斋已铺开（${result}）。浅色是宣纸，深色是灯下的墨。${await otherLooksOn($, 'ink-paper')}`,
    }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== $.plugin.name || e.props.scene !== SCENE_ID) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const { Svg } = $.ui.resolve(e)
    return <Svg source={SCENE} alt="An ink-wash landscape of layered mountains and drifting mist" isInteractive />
  })

  // The easter egg: a passing test run gets a 「准」 seal.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined || ran.deny !== undefined || ran.isError === true) return ran
    if (TEST_RE.test(e.command) && !FAIL_RE.test(ran.text ?? '') && (await read($, isOnAtom))) {
      $.ui.toast('「准」 测试通过，盖章。', { timeoutMs: 5000 })
    }
    return ran
  }).catch(($, e, next) => next(e))
}
