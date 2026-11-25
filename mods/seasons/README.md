# SEASONS · 四时

A look for Claude Code that changes by itself with the real season and the time of day.

## What it shows

| Season | Months | By day | By night |
| --- | --- | --- | --- |
| **Spring · 樱** | March to May | cherry petals drifting down under a pale pink sky | petals under a violet night sky and a crescent moon |
| **Summer · 萤** | June to August | dandelion seeds floating across green hills | fireflies glowing slowly over dark hills |
| **Autumn · 枫** | September to November | maple leaves in red, orange and gold falling under a warm sky | leaves in a dim amber night |
| **Winter · 雪** | December to February | snow over pale blue-white hills | snow under a deep blue night |

Day runs from 06:00 to 18:00. The seasons follow the northern-hemisphere months.

- **Colors**: each season has its own palette for both light and dark mode, tinted toward its hue. Red, green and amber keep their meaning.
- **Backdrop** (desktop app): a sky, a sun or crescent moon, two hills and about a dozen particles of the season, each taking 18 to 34 seconds to cross the screen. Fireflies brighten and dim over six seconds, so nothing flashes. Under reduced motion the particles hold still where they are.
- **It keeps up by itself**: the mod checks every hour and sets the look again only when the season or the time of day has changed.

## Commands

- `/seasons` or `/seasons on` turns the look on and follows the real date. It's on by default.
- `/seasons preview <spring|summer|autumn|winter> [day|night]` shows a season now, holding it until you run `/seasons auto`. For example: `/seasons preview winter night`.
- `/seasons auto` goes back to following the real season and time.
- `/seasons off` turns the look off. The choice is kept across sessions.

Only one look shows at a time. If another look mod is on, such as `neon-pilot`, `terminal-1983` or `ink-paper`, turn that one off first.
