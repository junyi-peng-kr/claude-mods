/** A file in `git diff HEAD`, or untracked. */
export type Change = {
  /** Path relative to the repository root. */
  path: string
  /** Lines added and deleted against HEAD; 0 and 0 for a binary file. */
  add: number
  del: number
  /** Not yet tracked by git. */
  isNew?: boolean
}

/** Edits Claude made to one file this session (Edit, Write, NotebookEdit). */
export type EditCount = { count: number; last: number }

export type Radar = {
  /** The repository root, or '' outside a repository. */
  root: string
  branch: string
  changes: Change[]
  /** Keyed by path relative to the root (absolute outside a repository). */
  edits: Record<string, EditCount>
  /** Epoch ms of the last scan. */
  scannedAt: number
  /** Edits to one file that count as churn; warned again at each multiple. */
  threshold: number
}

declare module 'claude-code' {
  interface PluginState {
    'diff-radar': {
      radar: Shaped<Radar>
    }
  }
}
