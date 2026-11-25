# CODE PET

A pixel pet that lives in Claude Code's side panel and grows with your coding: a blob, a corgi, a shiba, a cat or a bunny, in the coat and with the name you choose.

## How it lives

- **Food** fills up when tests pass (+30). It falls by 6 an hour.
- **Joy** goes up when you commit (+15), push (+10) or pat it (+8, once every 10 minutes). It drops when tests fail (−8) and falls by 3 an hour.
- **XP** comes from passing tests, commits, pushes, edits and finished turns. The pet grows from **egg → baby (15 XP) → kid (80) → adult (250)**.
- **Streak**: the first session of each new coding day adds XP for your streak of consecutive days, up to 30.
- **Mood** shows on its face: happy, full, calm, hungry, sad, or sleepy after 45 minutes without coding.

The pet never dies. Left alone, it only gets hungry and sad until you come back. It is saved in the mod's store, so the same pet greets you in every session and every project.

## Kinds, coats and names

| Kind | Coats |
| --- | --- |
| `bit` 小比特 (the original blob) | changes colour as it grows |
| `corgi` 柯基 | `tricolor` 三色, `red` 黄白, `sable` 貂色 |
| `shiba` 柴犬 | `red` 赤色, `black-tan` 黑色, `cream` 白色 |
| `cat` 猫 | `orange` 橘猫, `black` 黑猫, `gray` 狸花, `calico` 三花 |
| `bunny` 兔子 | `white` 白兔, `brown` 棕兔, `gray` 灰兔 |

An animal hatches from an egg in its coat's colours. It grows bigger as a baby and a kid, gets a red collar as a kid, and gets a gold tag as an adult.

There are three ways to choose:

- **In the panel**: the 外观 · 名字 section has pickers for the kind and the coat, and a name box.
- **With a command**: `/pet adopt corgi tricolor Ace` changes the kind, coat and name in one go. Your pet keeps its age, XP and history.
- **In the plugin's settings** (`species`, `coat`, `name`): set them to pin the pet's look and name in every session, for example when you share a setup with your team. `picked` and an empty name leave the choice to the panel and the commands.

## Commands

- `/pet` opens the panel.
- `/pet pat` pats it. The panel also has a **摸摸它** button (hotkey `p`).
- `/pet adopt <kind> [coat] [name]` changes its kind, coat and name, and `/pet kinds` lists them all.
- `/pet coat <coat>` changes only the coat.
- `/pet name <name>` renames it.
- `/pet stats` prints its age, XP, streak and lifetime counts.
- `/pet demo` plays its four reactions in a row.
- `/pet off` / `/pet on` hides or shows the panel and toasts. The pet keeps living either way.

The desktop app draws the pet as animated pixel art. The terminal shows it as a text face.
