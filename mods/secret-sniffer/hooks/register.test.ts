import { describe, expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { denyText, piecesOf } from './register'
import { addedLines, scan } from './scan'

// Fake values, built from parts so no scanner mistakes this file for a leak.
const j = (...parts: string[]) => parts.join('')
const AWS_ID = j('AKIA', 'Q3J5ZK2LMNOP7RST')
const AWS_SECRET = j('wJalrXUtnFEMI', 'K7MDENGbPxRfiCY', 'Zq9Lm3Np8Rt2')
const GH = j('ghp_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8')
const GH_PAT = j('github_pat_', '11ABCDEFG0', 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abcdefghijklmnopqrstuv')
const ANT = j('sk-ant-', 'api03-', 'Zx9Qw8Er7Ty6Ui5Op4As3Df2Gh1Jk0Lz')
const OAI = j('sk-', 'proj-', 'Ab12Cd34Ef56Gh78Ij90Kl12Mn34Op56')
const SLACK = j('xox', 'b-', '123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx')
const GOOGLE = j('AIza', 'SyD3x4mPl3K3y_Q9w8E7r6T5y4U3i2O1p0A')
const STRIPE = j('sk_', 'live_', '51Hx9Kq2Lm3Np4Rt5Vw6Xy7Za8Bc9De0')
const JWT = j('eyJ', 'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', '.eyJ', 'zdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ', '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')
const PEM = j('-----BEGIN ', 'RSA PRIVATE KEY', '-----')

const rules = (text: string) => scan(text).map(f => f.rule)

describe('true positives', () => {
  test('each kind of secret is found', () => {
    expect(rules(`const id = "${AWS_ID}"`)).toEqual(['aws-access-key'])
    expect(rules(`aws_secret_access_key = ${AWS_SECRET}`)).toEqual(['aws-secret-key'])
    expect(rules(`token: ${GH}`)).toEqual(['github-token'])
    expect(rules(GH_PAT)).toEqual(['github-token'])
    expect(rules(`ANTHROPIC_API_KEY=${ANT}`)).toEqual(['anthropic-key'])
    expect(rules(`openai.api_key = "${OAI}"`)).toEqual(['openai-key'])
    expect(rules(`SLACK=${SLACK}`)).toEqual(['slack-token'])
    expect(rules(`key=${GOOGLE}`)).toEqual(['google-api-key'])
    expect(rules(`Stripe(${JSON.stringify(STRIPE)})`)).toEqual(['stripe-live-key'])
    expect(rules(`Authorization: Bearer ${JWT}`)).toEqual(['jwt'])
    expect(rules(`${PEM}\nMIIEpAIBAAKCAQEA`)).toEqual(['private-key'])
    expect(rules(`const dbPassword = "${j('Tr0ub4dor', '&3xQ9zLk2m')}"`)).toEqual(['generic-secret'])
    expect(rules(`  client_secret: '${j('9fK2mQ7xL4pR8', 'sT1vW6yZ3bN5')}'`)).toEqual(['generic-secret'])
  })

  test('the secret is masked, and the line number is right', () => {
    const [f] = scan(`one\ntwo\nconst k = "${GH}"`, { path: 'src/a.ts' })
    expect(f?.line).toBe(3)
    expect(f?.masked).toContain('chars masked')
    expect(f?.masked).not.toContain(GH)
    expect(denyText(scan(`x=${STRIPE}`, { path: 'pay.ts' }), false)).not.toContain(STRIPE)
  })
})

describe('false positives stay quiet', () => {
  test('placeholders, env reads and ordinary code', () => {
    for (const text of [
      `AWS_ACCESS_KEY_ID=${j('AKIA', 'IOSFODNN7EXAMPLE')}`,
      'api_key = "<your-api-key>"',
      'API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxx"',
      'password: "changeme"',
      'token = "********************"',
      'secret = "${SECRET_FROM_ENV}"',
      'const apiKey = process.env.OPENAI_API_KEY',
      'password = os.environ["DB_PASSWORD"]',
      'const token = await getToken()',
      'passwordField: "password-input"',
      'TOKEN_URL = "https://auth.example.com/oauth/token"',
      'const secretName = "prod/db/credentials"',
      'test_token = "test-token-1234567890"',
      'sk-ant-... (your key here)',
      '-----BEGIN PUBLIC KEY-----',
      'const hash = "d41d8cd98f00b204e9800998ecf8427e"',
      'import { tokenize } from "./lexer"',
      'git commit -m "rotate token handling"',
    ]) {
      expect([text, rules(text)]).toEqual([text, []])
    }
  })

  test('an allowed path or line is skipped', () => {
    expect(scan(`k="${GH}"`, { path: 'tests/fixtures/tokens.json', allow: ['tests/fixtures/'] })).toEqual([])
    expect(scan(`k="${GH}" // sniffer:ignore`, { allow: ['sniffer:ignore'] })).toEqual([])
    expect(scan(`k="${GH}"`, { path: 'src/a.ts', allow: ['tests/fixtures/'] }).length).toBe(1)
  })
})

test('pieces come from each file tool', () => {
  expect(piecesOf('Write', { file_path: '/r/a', content: 'A' })).toEqual([{ path: '/r/a', text: 'A' }])
  expect(piecesOf('Edit', { file_path: '/r/a', old_string: 'x', new_string: 'B' })).toEqual([{ path: '/r/a', text: 'B' }])
  expect(piecesOf('MultiEdit', { file_path: '/r/a', edits: [{ new_string: 'C' }, { new_string: 'D' }] }).map(p => p.text)).toEqual(['C', 'D'])
  expect(piecesOf('NotebookEdit', { notebook_path: '/r/n.ipynb', new_source: 'E' })).toEqual([{ path: '/r/n.ipynb', text: 'E' }])
  expect(piecesOf('Read', { file_path: '/r/a' })).toEqual([])
})

test("a diff's added lines keep their line numbers", () => {
  const diff = [
    'diff --git a/src/a.ts b/src/a.ts',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '@@ -10,0 +11,2 @@',
    '+const a = 1',
    `+const k = "${GH}"`,
    '--- a/old.txt',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-gone',
  ].join('\n')
  const files = addedLines(diff)
  expect(files).toEqual([{ path: 'src/a.ts', text: `const a = 1\nconst k = "${GH}"`, lineNumbers: [11, 12] }])
  expect(scan(files[0]!.text, { path: files[0]!.path, lineNumbers: files[0]!.lineNumbers })[0]?.line).toBe(12)
})

function world(on: Parameters<TestBody>[1], staged: string) {
  mock.store(on)
  on('command.register', () => ({ value: { command: 'sniffer' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: staged, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
}

test('a write with a key is refused and never runs; a clean one runs', async ($, on) => {
  let ran = 0
  world(on, '')
  on('tool.call', () => {
    ran += 1
    return { result: {}, text: 'ok' }
  })
  await $.session.start({ cwd: '/r', surface: 'desktop', isInteractive: true })

  const bad = await $.tool.call({ tool: 'Write', file_path: '/r/config.ts', content: `export const KEY = "${ANT}"\n` })
  expect(bad.deny).toContain('Anthropic API key')
  expect(bad.deny).toContain('config.ts:1')
  expect(bad.deny).not.toContain(ANT)
  expect(ran).toBe(0)

  const good = await $.tool.call({ tool: 'Write', file_path: '/r/config.ts', content: 'export const KEY = process.env.ANTHROPIC_API_KEY\n' })
  expect(good.deny).toBeUndefined()
  expect(ran).toBe(1)
})

test('a commit whose staged lines add a key is refused', async ($, on) => {
  let ran = 0
  world(on, `+++ b/.env\n@@ -0,0 +1 @@\n+STRIPE_KEY=${STRIPE}\n`)
  on('tool.call', () => {
    ran += 1
    return { result: {}, text: 'ok' }
  })
  await $.session.start({ cwd: '/r', surface: 'desktop', isInteractive: true })
  const r = await $.tool.call({ tool: 'Bash', command: 'git commit -m "add config"' })
  expect(r.deny).toContain('refused this commit')
  expect(r.deny).toContain('.env:1')
  expect(ran).toBe(0)
})
