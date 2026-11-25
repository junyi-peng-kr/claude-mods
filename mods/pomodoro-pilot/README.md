# POMODORO PILOT

A pomodoro timer for Claude Code that paces you, not the model.

## What it does

- **Countdown in the status line**: `🍅 18:20 专注中 · 今日 2` while you focus, `☕ 03:10 休息中` on a break, and `🍅 今日 2` between pomodoros. It updates every 10 seconds.
- **When focus ends** you get a toast, today's count goes up, and a break starts on its own: 5 minutes, or 15 after every 4th pomodoro of the day.
- **When a break ends** you get a toast. Any long task that finished during the break is listed in it.
- **During a break**, the first prompt you send gets one gentle reminder that you're on a break. Claude keeps working as usual. A task that runs over a minute and finishes during the break isn't announced until the break ends. During focus, such a task gets a "done" toast right away.
- **Counts**: finished pomodoros are kept per day, for the last 14 days, across sessions.
- It never changes the theme, so it works beside any look mod.

## Commands

- `/pomo start [minutes]` starts focusing, 25 minutes by default.
- `/pomo break [minutes]` starts a break, 5 minutes by default.
- `/pomo stop` stops the timer. A pomodoro stopped early doesn't count.
- `/pomo status` prints the time left, today's count and the last 7 days' total.
- `/pomo` opens a small panel with a progress bar, start, break and stop buttons, today's tomatoes, and the last 7 days.

Times run from 1 to 180 minutes. The timer lives in the session: it survives a reload of the mod, but not a new session.
