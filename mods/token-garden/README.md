# TOKEN GARDEN

The context window as a garden in Claude Code's side panel.

## How it grows

- **Every turn plants one plant**, chosen by what the turn mostly did: reads grow grass, edits grow flowers, commands grow trees, subagents grow mushrooms, and the web and MCP tools grow vines. A turn with no tools grows a sprout.
- **The garden shows how full the context is.** Under 50% it's lush, with a blue sky and a bright sun. From 50% to 80% it dries out to straw colours under a hot sun. At 80% and above it wilts: brown, drooping plants, cracked soil and clouds.
- **At 80% a toast suggests `/compact` or a new session**, once per planting, and the panel opens.
- **A compaction or `/clear` replants** the garden from bare soil. A compaction a subagent runs on its own transcript doesn't count.

The gauge at the foot of the panel shows the context fill, with a dashed line at 80%. Below it, the panel counts turns and plants by kind.

## Commands

- `/garden` opens the panel.
- `/garden replant` starts the garden over. The panel's **重新翻土** button does the same.

The desktop app draws the garden as an illustration. The terminal shows the last 30 plants as a row of emoji with a text gauge. The garden lasts for the session: a new session starts with bare soil.
