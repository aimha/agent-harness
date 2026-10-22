// ============================================================
// ROLE: Tests for sync: generated files, local composition, lock, orphans and the CLI
// DEPENDS ON: lib/sync.js, bin/cli.js, node:test
// USED BY: npm test, CI of the package
// KEY DECISIONS: every test works on a fresh temp project, never on the repo itself
// GOTCHAS: the CLI targets cwd only because the repo checkout is not inside node_modules
// LAST UPDATED: 2026-10-22 - first version
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { sync, plan, composeOpencode, packageVersion, PKG_ROOT, LOCK_FILE, PATTERNS_FILE, SyncError } from '../lib/sync.js'

// Creates an empty project holding only its own patterns file
function project(patterns = '# PATTERNS — Pattern specifici dello stack\n\n- NestJS') {
  const root = mkdtempSync(join(tmpdir(), 'harness-'))
  mkdirSync(join(root, '.agent-guidelines'))
  writeFileSync(join(root, PATTERNS_FILE), patterns)
  return root
}

const read = (root, rel) => readFileSync(join(root, rel), 'utf8')
const writeJson = (root, rel, value) => writeFileSync(join(root, rel), JSON.stringify(value))

test('sync writes guidelines with the version banner and the project patterns last', () => {
  const root = project()
  sync(root)
  const agents = read(root, 'AGENTS.md')
  assert.match(agents, new RegExp(`^<!-- GENERATED da @aimha/agent-harness@${packageVersion().replaceAll('.', '\\.')}`))
  assert.ok(agents.indexOf('## Naming conventions') < agents.indexOf('# WORKFLOW'))
  assert.ok(agents.trimEnd().endsWith('- NestJS'))
  assert.equal(read(root, 'CLAUDE.md'), agents)
  assert.match(read(root, '.cursor/rules/base.mdc'), /^---\ndescription: .*\nalwaysApply: true\n---\n\n<!-- GENERATED/)
})

test('sync copies asset files byte for byte, dot folders included', () => {
  const root = project()
  sync(root)
  for (const rel of ['.opencode/skills/grilling/SKILL.md', '.github/workflows/ci.yml', 'openspec/config.yaml']) {
    assert.equal(read(root, rel), readFileSync(join(PKG_ROOT, 'assets', 'files', rel), 'utf8'), rel)
  }
})

test('check is clean right after sync and flags a hand-edited file', () => {
  const root = project()
  sync(root)
  assert.deepEqual(sync(root, { check: true }).stale, [])
  writeFileSync(join(root, 'AGENTS.md'), 'edited by hand')
  assert.deepEqual(sync(root, { check: true }).stale, ['AGENTS.md'])
  assert.equal(read(root, 'AGENTS.md'), 'edited by hand', 'check must not write')
  sync(root)
  assert.deepEqual(sync(root, { check: true }).stale, [])
})

test('a change to the project patterns makes the guidelines stale', () => {
  const root = project()
  sync(root)
  writeFileSync(join(root, PATTERNS_FILE), '# PATTERNS\n\n- SolidJS')
  assert.deepEqual(sync(root, { check: true }).stale.sort(), ['.cursor/rules/base.mdc', 'AGENTS.md', 'CLAUDE.md'])
})

test('missing patterns file is a readable error', () => {
  const root = project()
  rmSync(join(root, PATTERNS_FILE))
  assert.throws(() => sync(root), (error) => error instanceof SyncError && error.message.includes(PATTERNS_FILE))
})

test('lock lists every managed file and the installed version', () => {
  const root = project()
  sync(root)
  const lock = JSON.parse(read(root, LOCK_FILE))
  assert.equal(lock.version, packageVersion())
  assert.deepEqual(lock.files, [...plan(root).keys()].filter((rel) => rel !== LOCK_FILE).sort())
})

test('files dropped by the package are removed, lock paths outside the project are refused', () => {
  const root = project()
  sync(root)
  mkdirSync(join(root, 'old'))
  writeFileSync(join(root, 'old/rule.md'), 'x')
  writeFileSync(join(root, 'mine.md'), 'project file')
  const lock = JSON.parse(read(root, LOCK_FILE))
  writeJson(root, LOCK_FILE, { ...lock, files: [...lock.files, 'old/rule.md'] })
  assert.deepEqual(sync(root, { check: true }).orphans, ['old/rule.md'])
  sync(root)
  assert.equal(existsSync(join(root, 'old/rule.md')), false)
  assert.equal(existsSync(join(root, 'mine.md')), true, 'files never listed in the lock are left alone')

  for (const bad of ['../outside.md', '/etc/passwd', 'a/../../b']) {
    writeJson(root, LOCK_FILE, { ...lock, files: [bad] })
    assert.throws(() => sync(root, { check: true }), SyncError, bad)
  }
})

test('project permissions are appended after the base ones', () => {
  const base = { $schema: 's', permission: { bash: { '*': 'ask', 'npm run *': 'allow', 'git push *': 'ask' }, edit: { '*': 'allow' } } }
  const local = { permission: { bash: { 'npm run *': 'ask', 'npm run deploy*': 'deny' }, webfetch: 'deny' }, model: 'x' }
  const result = composeOpencode(base, local)
  assert.deepEqual(Object.keys(result.permission.bash), ['*', 'git push *', 'npm run *', 'npm run deploy*'])
  assert.equal(result.permission.bash['npm run *'], 'ask')
  assert.equal(result.permission.webfetch, 'deny')
  assert.deepEqual(result.permission.edit, { '*': 'allow' })
  assert.equal(result.model, 'x')
  assert.deepEqual(base.permission.bash, { '*': 'ask', 'npm run *': 'allow', 'git push *': 'ask' }, 'base is not mutated')
})

test('opencode.local.json is composed into opencode.json and invalid json is reported', () => {
  const root = project()
  writeJson(root, 'opencode.local.json', { permission: { edit: { 'vite.config.*': 'deny' } } })
  sync(root)
  const edit = JSON.parse(read(root, 'opencode.json')).permission.edit
  assert.equal(Object.keys(edit).at(-1), 'vite.config.*')
  writeFileSync(join(root, 'opencode.local.json'), '{ not json')
  assert.throws(() => sync(root), (error) => error instanceof SyncError && error.message.includes('opencode.local.json'))
})

// Runs the CLI inside a project and returns status and output
function cli(root, ...args) {
  const result = spawnSync(process.execPath, [join(PKG_ROOT, 'bin', 'cli.js'), ...args], { cwd: root, encoding: 'utf8' })
  return { status: result.status, out: result.stdout + result.stderr }
}

test('cli: sync --check fails before sync, passes after, reports the version gap', () => {
  const root = project()
  assert.equal(cli(root, 'sync', '--check').status, 1)
  assert.equal(cli(root, 'sync').status, 0)
  assert.equal(cli(root, 'sync', '--check').status, 0)
  const lock = JSON.parse(read(root, LOCK_FILE))
  writeJson(root, LOCK_FILE, { ...lock, version: '0.0.0-old' })
  const { status, out } = cli(root, 'sync', '--check')
  assert.equal(status, 1)
  assert.match(out, /versione 0\.0\.0-old/)
})

test('cli: user errors exit 1 without a stack trace', () => {
  const root = project()
  rmSync(join(root, PATTERNS_FILE))
  const { status, out } = cli(root, 'sync')
  assert.equal(status, 1)
  assert.doesNotMatch(out, /at .*\.js:\d+/)
  assert.equal(cli(root, 'nope').status, 1)
})
