// CODE PET: a pixel pet in the side panel that lives off your coding.
//  - Passing tests feed it, commits and pushes cheer it, failing tests upset it.
//  - Food and joy fall slowly over time; it never dies, it only sulks.
//  - XP grows it: egg → baby → kid → adult. A new coding day adds a streak bonus.
//  - Kept in $.store, so the same pet greets you in every session.
//  - Kinds: the blob (bit), corgi, shiba, cat and bunny, each in a few coats; pick
//    them in the panel, with /pet adopt, or in the plugin's settings.
//  - /pet [show | pat | adopt <kind> [coat] [name] | coat <coat> | kinds | name <name> | stats | on | off | demo]
import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { Pet, Reaction, ReactionKind, Species } from '../types'
import { MOOD_ZH, STAGE_ZH, bar, moodOf, nextStage, petSvg, petText, stageOf } from './art'
import { KINDS, SPECIES, coatOf, isSpecies } from './species'

const STORE_PET = 'code-pet.pet'
const STORE_ON = 'code-pet.isOn'
const PANE = 'code-pet'
const REACTION_MS = 5000
const PAT_GAP_MS = 10 * 60 * 1000

const newPet = (now: number): Pet => ({
  name: '小比特',
  species: 'bit',
  coat: 'classic',
  born: now,
  xp: 0,
  food: 70,
  joy: 70,
  lastTick: now,
  lastActive: now,
  lastPatAt: 0,
  days: [],
  meals: 0,
  commits: 0,
  stumbles: 0,
})

const petAtom = atom({ plugin: 'code-pet', key: 'pet' } as const, newPet(0), { shape: 'pet-2' })
const reactionAtom = atom({ plugin: 'code-pet', key: 'reaction' } as const, null, { shape: 'reaction-1' })
const isOnAtom = atom({ plugin: 'code-pet', key: 'isOn' } as const, true)

const TEST_RE =
  /(^|[\s;&|(])((npm|pnpm|yarn|bun)\s+(run\s+)?test\b|npx\s+(jest|vitest|mocha|playwright)\b|(jest|vitest|pytest|mocha|rspec|phpunit)\b|go\s+test\b|cargo\s+(test|nextest)\b|python3?\s+-m\s+(pytest|unittest)\b|make\s+test\b|deno\s+test\b|swift\s+test\b|mvn\s+test\b|gradle\w*\s+test\b)/
const FAIL_RE = /\b[1-9]\d*\s+(failed|failing|failures?)\b|\bFAIL(ED)?\b|Tests?:\s+[1-9]\d*\s+failed/
const COMMIT_RE = /(^|[\s;&|(])git\s+commit\b/
const PUSH_RE = /(^|[\s;&|(])git\s+push\b/

const clamp = (n: number) => Math.max(0, Math.min(100, n))
const dayOf = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Consecutive coding days ending today or yesterday. */
export function streakOf(days: string[], now: number): number {
  const set = new Set(days)
  let n = 0
  let t = now
  if (!set.has(dayOf(t))) t -= 86_400_000
  while (set.has(dayOf(t))) {
    n += 1
    t -= 86_400_000
  }
  return n
}

/** Food and joy fall with time: 6 food and 3 joy an hour. */
export function decay(pet: Pet, now: number): Pet {
  const hours = Math.max(0, now - pet.lastTick) / 3_600_000
  if (hours < 0.01) return pet
  return { ...pet, food: clamp(pet.food - 6 * hours), joy: clamp(pet.joy - 3 * hours), lastTick: now }
}

let reactionSeq = 0

async function save($: EngineInterface, pet: Pet) {
  await update($, petAtom, () => pet)
  await $.store.set(STORE_PET, pet)
}

async function react($: EngineInterface, kind: ReactionKind, text: string, toast: boolean) {
  const id = ++reactionSeq
  await update($, reactionAtom, () => ({ kind, text, id }))
  if (toast && (await read($, isOnAtom))) $.ui.toast(text, { timeoutMs: REACTION_MS })
  $.clock.after(REACTION_MS, () => {
    void update($, reactionAtom, cur => (cur && cur.id === id ? null : cur))
  })
}

/** Applies a change to the pet, saves it, and announces an evolution. */
async function mutate(
  $: EngineInterface,
  fn: (pet: Pet) => Pet,
  reaction?: { kind: ReactionKind; text: string; toast?: boolean },
) {
  const now = Date.now()
  const before = decay(await read($, petAtom), now)
  const after = fn(before)
  await save($, after)
  const from = stageOf(before.xp)
  const to = stageOf(after.xp)
  if (from !== to) {
    await react($, 'evolve', `✨ ${after.name} 进化了：${STAGE_ZH[from]} → ${STAGE_ZH[to]}！`, true)
  } else if (reaction) {
    await react($, reaction.kind, reaction.text, reaction.toast ?? false)
  }
}

const active = (pet: Pet): Pet => ({ ...pet, lastActive: Date.now() })

/** What the plugin's settings pin, if anything: they win over the panel's choice. */
export type Pinned = { species?: Species; coat?: string; name?: string }

export function pinnedOf(options: PluginOptions | undefined): Pinned {
  const species = options?.species
  const coat = options?.coat
  const name = typeof options?.name === 'string' ? options.name.trim().slice(0, 16) : ''
  return {
    ...(isSpecies(species) ? { species } : {}),
    ...(typeof coat === 'string' && coat !== 'picked' ? { coat } : {}),
    ...(name ? { name } : {}),
  }
}

/** Applies a kind, coat and name, keeping the pet's age, XP and history. */
export function dress(pet: Pet, species: Species, coat?: string, name?: string): Pet {
  const isSameKind = pet.species === species
  const wasDefaultName = pet.name === KINDS[pet.species]?.defaultName
  return {
    ...pet,
    species,
    coat: coatOf(species, coat ?? (isSameKind ? pet.coat : undefined)).key,
    name: name ?? (wasDefaultName ? KINDS[species].defaultName : pet.name),
  }
}

let pinned: Pinned = {}

async function load($: EngineInterface) {
  const now = Date.now()
  const stored = (await $.store.get(STORE_PET)) as Partial<Pet> | undefined
  let pet = decay({ ...newPet(now), ...(stored ?? {}) }, now)
  if (!isSpecies(pet.species)) pet = { ...pet, species: 'bit', coat: 'classic' }
  if (pinned.species || pinned.coat || pinned.name) {
    pet = dress(pet, pinned.species ?? pet.species, pinned.coat ?? (pinned.species ? undefined : pet.coat), pinned.name)
  }
  const today = dayOf(now)
  let isNewDay = false
  if (!pet.days.includes(today)) {
    isNewDay = pet.days.length > 0
    pet = { ...pet, days: [...pet.days, today].slice(-60) }
  }
  const streak = streakOf(pet.days, now)
  if (isNewDay) pet = { ...pet, xp: pet.xp + Math.min(5 * streak, 30) }
  await save($, pet)
  return { pet, isNew: stored === undefined, isNewDay, streak }
}

function ageText(pet: Pet, now: number): string {
  const days = Math.floor((now - pet.born) / 86_400_000)
  return days < 1 ? '今天出生' : `${days} 天大`
}

function kindLine(pet: Pet): string {
  const kind = KINDS[pet.species]
  const { coat } = coatOf(pet.species, pet.coat)
  return pet.species === 'bit' ? kind.zh : `${coat.zh}${kind.zh}`
}

async function adopt($: EngineInterface, species: Species, coat?: string, name?: string): Promise<string> {
  const before = await read($, petAtom)
  await mutate($, p => dress(p, species, coat, name), { kind: 'happy', text: '' })
  const after = await read($, petAtom)
  await update($, reactionAtom, r => (r ? { ...r, text: `${after.name}：我现在是一只${kindLine(after)}啦！` } : r))
  await $.ui.open({ id: PANE, title: `${after.name} · 代码宠物` })
  const lock = pinned.species || pinned.coat || pinned.name ? '（注意：插件设置里固定了外观或名字，下次开会话会按设置来。）' : ''
  return `${before.name} 变成了${kindLine(after)}「${after.name}」，XP 和成长都保留着。${lock}`
}

function kindsText(): string {
  return [
    '可选的宠物和毛色：',
    ...SPECIES.map(sp => `  ${sp} · ${KINDS[sp].zh}：${Object.entries(KINDS[sp].coats).map(([k, c]) => `${k}（${c.zh}）`).join('、')}`),
    '例：/pet adopt corgi tricolor Ace',
  ].join('\n')
}

async function pat($: EngineInterface): Promise<string> {
  const pet = await read($, petAtom)
  const now = Date.now()
  if (now - pet.lastPatAt < PAT_GAP_MS) {
    await react($, 'pat', `${pet.name} 蹭了蹭你的手`, false)
    return `${pet.name} 已经被摸过啦，过一会儿再来。`
  }
  await mutate($, p => ({ ...p, joy: clamp(p.joy + 8), lastPatAt: now, xp: p.xp + 1 }), {
    kind: 'pat',
    text: `${pet.name} 眯起眼睛，心情 +8`,
  })
  return `你摸了摸 ${pet.name}，心情 +8。`
}

export const register: Register = (on, options) => {
  pinned = pinnedOf(options)

  on('session.start', async ($, e, next) => {
    const isOn = (await $.store.get(STORE_ON)) !== false
    await update($, isOnAtom, () => isOn)
    await $.command.register({
      name: 'pet',
      description: 'Your code pet: /pet show | pat | adopt <kind> [coat] [name] | coat <coat> | kinds | name <name> | stats | on | off | demo',
      argumentHint: 'show | pat | adopt <kind> [coat] [name] | coat <coat> | kinds | name <name> | stats | on | off | demo',
    })
    const { pet, isNew, isNewDay, streak } = await load($)
    if (isOn) {
      void $.ui.open({ id: PANE, title: `${pet.name} · 代码宠物` })
      if (isNew) await react($, 'happy', `🥚 你领养了一颗${kindLine(pet)}蛋！面板里可以选宠物、毛色和名字。跑通测试喂它，提交代码让它开心。`, true)
      else if (isNewDay) await react($, 'happy', `${pet.name}：又见面啦！连续打卡 ${streak} 天`, true)
    }
    // Decay and the sleepy look move on their own: redraw once a minute.
    $.clock.every(60_000, () => {
      void (async () => {
        const cur = await read($, petAtom)
        await save($, decay(cur, Date.now()))
      })()
    })
    return next(e)
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    const [verb = 'show', ...rest] = e.args.trim().split(/\s+/).filter(Boolean)
    const arg = rest.join(' ')
    const pet = decay(await read($, petAtom), Date.now())
    switch (verb.toLowerCase()) {
      case 'off':
        await update($, isOnAtom, () => false)
        await $.store.set(STORE_ON, false)
        await $.ui.close({ id: PANE })
        return { text: `${pet.name} 去休息了（面板和提示已关闭，宠物还在）。/pet on 叫它回来。` }
      case 'on':
        await update($, isOnAtom, () => true)
        await $.store.set(STORE_ON, true)
        await $.ui.open({ id: PANE, title: `${pet.name} · 代码宠物` })
        return { text: `${pet.name} 回来了！` }
      case 'pat':
        return { text: await pat($) }
      case 'kinds':
        return { text: kindsText() }
      case 'adopt': {
        const [kind = '', coat, ...nameParts] = rest
        if (!isSpecies(kind)) return { text: `用法：/pet adopt <宠物> [毛色] [名字]\n${kindsText()}` }
        const hasCoat = coat !== undefined && coat in KINDS[kind].coats
        const name = (hasCoat ? nameParts : [coat ?? '', ...nameParts]).join(' ').trim().slice(0, 16)
        return { text: await adopt($, kind, hasCoat ? coat : undefined, name || undefined) }
      }
      case 'coat': {
        if (!arg || !(arg in KINDS[pet.species].coats)) {
          return { text: `${KINDS[pet.species].zh}的毛色有：${Object.entries(KINDS[pet.species].coats).map(([k, c]) => `${k}（${c.zh}）`).join('、')}` }
        }
        return { text: await adopt($, pet.species, arg) }
      }
      case 'name': {
        const name = arg.slice(0, 16)
        if (!name) return { text: '用法：/pet name <名字>（最多 16 个字）' }
        await mutate($, p => ({ ...p, name }), { kind: 'happy', text: `从今天起我叫 ${name}！` })
        await $.ui.open({ id: PANE, title: `${name} · 代码宠物` })
        return { text: `宠物改名为「${name}」。` }
      }
      case 'stats': {
        const now = Date.now()
        const nx = nextStage(pet.xp)
        return {
          text: [
            `${pet.name} · ${STAGE_ZH[stageOf(pet.xp)]} · ${ageText(pet, now)}`,
            `XP ${Math.round(pet.xp)}${nx ? `（距离${STAGE_ZH[nx.stage]}还差 ${Math.ceil(nx.need - pet.xp)}）` : '（已完全进化）'}`,
            `饱食 ${Math.round(pet.food)} · 心情 ${Math.round(pet.joy)} · 连续打卡 ${streakOf(pet.days, now)} 天`,
            `吃过 ${pet.meals} 顿测试果 · 见证 ${pet.commits} 次提交 · 陪你摔了 ${pet.stumbles} 跤`,
          ].join('\n'),
        }
      }
      case 'demo': {
        await $.ui.open({ id: PANE, title: `${pet.name} · 代码宠物` })
        const steps: Array<[ReactionKind, string]> = [
          ['sad', '测试挂了……呜'],
          ['eat', '吃到测试通过的果子，好甜！'],
          ['happy', '提交成功，撒花！'],
          ['pat', '被摸摸了，开心'],
        ]
        steps.forEach(([k, t], i) => $.clock.after(1 + i * 2500, () => void react($, k, t, false)))
        return { text: `${pet.name} 正在表演：难过 → 进食 → 开心 → 被摸。` }
      }
      default:
        await $.ui.open({ id: PANE, title: `${pet.name} · 代码宠物` })
        return { text: `${pet.name} 的面板已打开。` }
    }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) return ran
    const ok = ran.deny === undefined && ran.isError !== true
    if (e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'NotebookEdit') {
      if (ok) await mutate($, p => active({ ...p, xp: p.xp + 0.5 }))
      return ran
    }
    if (e.tool !== 'Bash' || ran.deny !== undefined) return ran
    const cmd = e.command
    const text = ran.text ?? ''
    if (TEST_RE.test(cmd)) {
      if (ok && !FAIL_RE.test(text)) {
        await mutate(
          $,
          p => active({ ...p, food: clamp(p.food + 30), joy: clamp(p.joy + 10), xp: p.xp + 10, meals: p.meals + 1 }),
          { kind: 'eat', text: `🍎 测试通过！${(await read($, petAtom)).name} 吃得很香`, toast: true },
        )
      } else {
        await mutate($, p => active({ ...p, joy: clamp(p.joy - 8), stumbles: p.stumbles + 1 }), {
          kind: 'sad',
          text: `测试没过……${(await read($, petAtom)).name} 有点难过`,
        })
      }
    } else if (ok && COMMIT_RE.test(cmd)) {
      await mutate($, p => active({ ...p, joy: clamp(p.joy + 15), xp: p.xp + 15, commits: p.commits + 1 }), {
        kind: 'happy',
        text: `🎉 提交成功！${(await read($, petAtom)).name} 在转圈圈`,
        toast: true,
      })
    } else if (ok && PUSH_RE.test(cmd)) {
      await mutate($, p => active({ ...p, joy: clamp(p.joy + 10), xp: p.xp + 10 }), {
        kind: 'happy',
        text: `🚀 推送成功！${(await read($, petAtom)).name} 挥手送别代码`,
        toast: true,
      })
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && !e.isAborted) await mutate($, p => ({ ...p, xp: p.xp + 1 }))
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const pet = await read($, petAtom)
    const reaction = await read($, reactionAtom)
    const now = Date.now()
    const mood = moodOf(pet, reaction, now)
    const stage = stageOf(pet.xp)
    const nx = nextStage(pet.xp)
    const streak = streakOf(pet.days, now)
    const els = $.ui.resolve(e)
    const { Box, Text, Button, Select, Input } = els
    const coats = KINDS[pet.species].coats
    const say = reaction?.text ?? `${MOOD_ZH[mood]}${mood === 'hungry' ? '，想吃测试通过的果子' : mood === 'sleepy' ? '，好久没写代码了' : ''}`
    const xpLine = nx
      ? `XP ${Math.round(pet.xp)} / ${nx.need} → ${STAGE_ZH[nx.stage]}`
      : `XP ${Math.round(pet.xp)} · 已完全进化`
    const xpPct = nx ? ((pet.xp - nx.from) / (nx.need - nx.from)) * 100 : 100

    const art =
      e.surface !== 'terminal' && 'Svg' in els ? (
        <els.Svg
          source={petSvg(pet, mood, e.props.bodyColumns * 8)}
          alt={`${pet.name}，${STAGE_ZH[stage]}，${MOOD_ZH[mood]}`}
          isInteractive
        />
      ) : (
        <Text bold color="#8EE3C8">
          {petText(pet, mood)}
        </Text>
      )

    return (
      <Box flexDirection="column" gap={1}>
        {art}
        <Box flexDirection="column">
          <Text bold>
            {pet.name} · {kindLine(pet)} · {STAGE_ZH[stage]} · {ageText(pet, now)}
            {streak > 1 ? ` · 🔥${streak} 天` : ''}
          </Text>
          <Text dimColor>「{say}」</Text>
        </Box>
        <Box flexDirection="column">
          <Text>饱食 {bar(pet.food)} {Math.round(pet.food)}</Text>
          <Text>心情 {bar(pet.joy)} {Math.round(pet.joy)}</Text>
          <Text>成长 {bar(xpPct)} </Text>
          <Text dimColor>{xpLine}</Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          <Button key="pat" label="摸摸它" hotkey="p" onPress={() => pat($)} />
        </Box>
        <Text dimColor>
          🍎 {pet.meals} · 🎉 {pet.commits} · 🩹 {pet.stumbles}
        </Text>
        <Box flexDirection="column" gap={1}>
          <Text bold>外观 · 名字</Text>
          <Select
            key="species"
            label="宠物"
            value={pet.species}
            options={SPECIES.map(sp => ({ value: sp, label: KINDS[sp].zh }))}
            onSelect={value => (isSpecies(value) ? adopt($, value) : undefined)}
          />
          {Object.keys(coats).length > 1 && (
            <Select
              key="coat"
              label="毛色"
              value={coatOf(pet.species, pet.coat).key}
              options={Object.entries(coats).map(([k, c]) => ({ value: k, label: c.zh }))}
              onSelect={value => adopt($, pet.species, value)}
            />
          )}
          <Input
            key="name"
            label="名字"
            placeholder={pet.name}
            submitLabel="改名"
            onSubmit={value => (value.trim() ? adopt($, pet.species, undefined, value.trim().slice(0, 16)) : undefined)}
          />
        </Box>
      </Box>
    )
  })
}
