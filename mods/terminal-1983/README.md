# TERMINAL 1983

A phosphor CRT look for Claude Code, in green (P1) or amber (P3).

## What it changes

- **Look** (desktop app): monochrome phosphor colors everywhere, and a dark tube behind the conversation with a soft glow, fine scanlines, a vignette and one faint band rolling down every 14 seconds. Under reduced motion the scene holds still.
- **Messages**: monospaced text, your messages in a square box with a thin phosphor border, Claude's replies on plain glass, and tool rows in square boxes.
- **Sound**, once you press the speaker in the session's title bar: a very low tube hum, and short square-wave beeps when you send, when a tool runs, when a reply finishes and on an error.
- **System console** (side panel, terminal included): each tool call shown as a mainframe job, for example `JOB 0042 BASH      COMPLETE  00:02.1`, with `EXECUTING`, `ABEND` for a failed call and `HELD` for a refused one.

## Commands

- `/crt` or `/crt on` turns the look on. It's on by default.
- `/crt green` / `/crt amber` switches the phosphor. Your choice is kept across sessions.
- `/crt console` opens the system console.
- `/crt off` turns the look off.

Only one look shows at a time. If another look mod is on, such as `neon-pilot`, turn that one off first (`/neon off`).
