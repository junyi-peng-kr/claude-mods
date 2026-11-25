export type CallKind = 'read' | 'write' | 'exec' | 'agent' | 'web' | 'mcp' | 'other'

export type CallStatus = 'run' | 'ok' | 'err' | 'denied'

export type Call = {
  id: string
  tool: string
  kind: CallKind
  /** A short line saying what the call did: the command, the file, the pattern. */
  label: string
  /** Epoch ms. */
  start: number
  /** Epoch ms; absent while the call runs. */
  end?: number
  status: CallStatus
  /** Made inside a subagent's loop. */
  isSub?: boolean
}

export type Turn = {
  n: number
  id: string
  prompt: string
  start: number
  end?: number
  isAborted?: boolean
  calls: Call[]
}

export type Flight = { turns: Turn[]; nextN: number }

declare module 'claude-code' {
  interface PluginState {
    'flight-recorder': {
      flight: Shaped<Flight>
    }
  }
}
