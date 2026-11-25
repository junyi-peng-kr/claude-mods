// What SECRET SNIFFER looks for, and scanning text for it. No `$` here.
import type { Finding } from '../types'

export type Detector = {
  id: string
  label: string
  /** Global regex; group 1, when present, is the secret itself, else the whole match. */
  re: RegExp
  /** An extra check on the secret, for the generic rule. */
  check?: (value: string) => boolean
}

/** Shannon entropy in bits per character. */
export function entropy(s: string): number {
  const counts = new Map<string, number>()
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let h = 0
  for (const n of counts.values()) {
    const p = n / s.length
    h -= p * Math.log2(p)
  }
  return h
}

const PLACEHOLDER = /x{4,}|X{4,}|<[^>]*>|\{\{|\$\{|example|changeme|change[_-]?me|your[_-]?(?:key|token|secret|password|api)|placeholder|dummy|sample|redacted|fake|\*{3,}|\.{3}|…|replace[_-]?me|insert[_-]?/i

export function isPlaceholder(value: string): boolean {
  return PLACEHOLDER.test(value) || /^(.)\1+$/.test(value)
}

const looksRandom = (v: string) =>
  v.length >= 12 &&
  !/\s/.test(v) &&
  /[A-Za-z]/.test(v) &&
  /\d/.test(v) &&
  entropy(v) >= 3.5 &&
  !/^(?:true|false|null|none|undefined)$/i.test(v) &&
  !/^(?:https?:)?\/\//.test(v) &&
  !/test/i.test(v) &&
  !/^(?:process\.env|os\.environ|env\(|getenv)/i.test(v)

export const DETECTORS: Detector[] = [
  { id: 'private-key', label: 'private key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g },
  { id: 'aws-access-key', label: 'AWS access key ID', re: /\b((?:AKIA|ASIA|AGPA|AIDA|AROA)[0-9A-Z]{16})\b/g },
  {
    id: 'aws-secret-key',
    label: 'AWS secret access key',
    re: /aws_?secret_?access_?key["']?\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})(?![A-Za-z0-9/+=])/gi,
  },
  { id: 'github-token', label: 'GitHub token', re: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g },
  { id: 'anthropic-key', label: 'Anthropic API key', re: /\b(sk-ant-[A-Za-z0-9_-]{20,})/g },
  { id: 'openai-key', label: 'OpenAI-style sk- key', re: /\b(sk-(?:proj-|svcacct-|admin-)?(?!ant-)[A-Za-z0-9_-]{20,})/g },
  { id: 'slack-token', label: 'Slack token', re: /\b(xox[abposr]-[A-Za-z0-9-]{10,})/g },
  { id: 'slack-webhook', label: 'Slack webhook URL', re: /(https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{20,})/g },
  { id: 'google-api-key', label: 'Google API key', re: /\b(AIza[0-9A-Za-z_-]{35})(?![0-9A-Za-z_-])/g },
  { id: 'stripe-live-key', label: 'Stripe live key', re: /\b((?:sk|rk)_live_[0-9a-zA-Z]{20,})/g },
  { id: 'jwt', label: 'JSON Web Token', re: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g },
  {
    id: 'generic-secret',
    label: 'secret-looking value assigned to a secret-named key',
    re: /[A-Za-z0-9_.-]*(?:secret|token|passwd|password|api[_-]?key|access[_-]?key|auth[_-]?key|client[_-]?secret)[A-Za-z0-9_.-]*["']?\s*[:=]\s*["'`]([^"'`\s]{12,})["'`]/gi,
    check: looksRandom,
  },
]

export function mask(secret: string): string {
  const keep = Math.min(4, Math.floor(secret.length / 4))
  return `${secret.slice(0, keep)}…[${secret.length} chars masked]`
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export type ScanOptions = {
  /** Sources of regexes; a line or path any of them matches is skipped. */
  allow?: readonly string[]
  path?: string
  /** Line numbers for each line of `text`, when they are not 1, 2, 3… (a diff's added lines). */
  lineNumbers?: readonly number[]
}

function compileAll(sources: readonly string[]): RegExp[] {
  return sources.flatMap(src => {
    try {
      return [new RegExp(src, 'i')]
    } catch {
      return []
    }
  })
}

/** Every secret in `text`, one finding per secret, the value masked. */
export function scan(text: string, options: ScanOptions = {}): Finding[] {
  const allow = compileAll(options.allow ?? [])
  const path = options.path ?? ''
  if (path && allow.some(re => re.test(path))) return []
  const findings: Finding[] = []
  const lines = text.split('\n')
  lines.forEach((raw, i) => {
    if (raw.length > 20000) return
    if (allow.some(re => re.test(raw))) return
    const taken: Array<[number, number]> = []
    for (const d of DETECTORS) {
      d.re.lastIndex = 0
      for (const m of raw.matchAll(d.re)) {
        const secret = m[1] ?? m[0]
        const start = (m.index ?? 0) + m[0].indexOf(secret)
        const end = start + secret.length
        if (taken.some(([a, b]) => start < b && end > a)) continue
        if (d.id !== 'private-key' && isPlaceholder(secret)) continue
        if (d.check && !d.check(secret)) continue
        taken.push([start, end])
        const masked = d.id === 'private-key' ? raw.trim() : `${raw.slice(0, start)}${mask(secret)}${raw.slice(end)}`
        findings.push({
          rule: d.id,
          label: d.label,
          path,
          line: options.lineNumbers?.[i] ?? i + 1,
          masked: clip(masked.trim(), 120),
        })
      }
    }
  })
  return findings
}

/** The added lines of a `git diff -U0`, per file, with their line numbers in the new file. */
export function addedLines(diff: string): Array<{ path: string; text: string; lineNumbers: number[] }> {
  const files: Array<{ path: string; lines: string[]; lineNumbers: number[] }> = []
  let cur: (typeof files)[number] | undefined
  let next = 0
  for (const row of diff.split('\n')) {
    if (row.startsWith('+++ ')) {
      const p = row.slice(4).replace(/^b\//, '')
      cur = p === '/dev/null' ? undefined : { path: p, lines: [], lineNumbers: [] }
      if (cur) files.push(cur)
      continue
    }
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunk) {
      next = Number(hunk[1])
      continue
    }
    if (cur && row.startsWith('+')) {
      cur.lines.push(row.slice(1))
      cur.lineNumbers.push(next)
      next += 1
    }
  }
  return files.map(f => ({ path: f.path, text: f.lines.join('\n'), lineNumbers: f.lineNumbers }))
}
