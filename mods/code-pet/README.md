# CODE PET

A pixel pet that lives in Claude Code's side panel and grows with your coding.

## How it lives

- **Food** fills up when tests pass (+30). It falls by 6 an hour.
- **Joy** goes up when you commit (+15), push (+10) or pat it (+8, once every 10 minutes). It drops when tests fail (−8) and falls by 3 an hour.
- **XP** comes from passing tests, commits, pushes, edits and finished turns. The pet grows from **egg → baby (15 XP) → kid (80) → adult (250)**.
- **Streak**: the first session of each new coding day adds XP for your streak of consecutive days, up to 30.
- **Mood** shows on its face: happy, full, calm, hungry, sad, or sleepy after 45 minutes without coding.

The pet never dies. Left alone, it only gets hungry and sad until you come back. It is saved in the mod's store, so the same pet greets you in every session and every project.

## Commands

- `/pet` opens the panel.
- `/pet pat` pats it. The panel also has a **摸摸它** button (hotkey `p`).
- `/pet name <name>` renames it.
- `/pet stats` prints its age, XP, streak and lifetime counts.
- `/pet demo` plays its four reactions in a row.
- `/pet off` / `/pet on` hides or shows the panel and toasts. The pet keeps living either way.

The desktop app draws the pet as animated pixel art. The terminal shows it as a text face.
