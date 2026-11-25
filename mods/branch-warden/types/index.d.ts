export type Mode = 'ask' | 'block' | 'warn'

export type Warden = {
  /** The repository root, or '' outside a repository. */
  root: string
  /** The current branch; '' when detached or outside a repository. */
  branch: string
  isProtected: boolean
  /** Branches you let Claude edit on this session, after saying yes once. */
  allowed: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'branch-warden': {
      warden: Shaped<Warden>
    }
  }
}
