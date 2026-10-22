// ============================================================
// ROLE: Shared fixtures for the tests: temp projects, git repos and CLI runs
// DEPENDS ON: lib/sync.js, lib/deps.js, bin/cli.js
// USED BY: test/*.test.js
// KEY DECISIONS: a fake node_modules/@fission-ai/openspec with the pinned version makes
//   the project look like a real install without running npm
// GOTCHAS: git identity and hooksPath are set per repo, so the host git config never leaks in
// LAST UPDATED: 2026-10-22 - first version
// ============================================================

import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync, spawnSync } from 'child_process'
import { PKG_ROOT, PATTERNS_FILE } from '../lib/sync.js'
import { pinnedVersion } from '../lib/deps.js'

// Creates a project holding its own patterns file, an .nvmrc and a fake pinned OpenSpec install
export function project(patterns = '# PATTERNS — Pattern specifici dello stack\n\n- NestJS') {
  const root = mkdtempSync(join(tmpdir(), 'harness-'))
  mkdirSync(join(root, '.agent-guidelines'))
  writeFileSync(join(root, PATTERNS_FILE), patterns)
  writeFileSync(join(root, '.nvmrc'), '24\n')
  fakeOpenspec(root, pinnedVersion('@fission-ai/openspec'))
  return root
}

// Writes a node_modules/@fission-ai/openspec/package.json with the given version
export function fakeOpenspec(root, version) {
  const dir = join(root, 'node_modules', '@fission-ai', 'openspec')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@fission-ai/openspec', version }))
}

// Runs git in a folder and returns its trimmed output
export function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

// Turns a project into a git repo on main with an isolated identity and no hooks
export function gitRepo(root) {
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'config', 'user.email', 'test@example.com')
  git(root, 'config', 'user.name', 'test')
  git(root, 'config', 'core.hooksPath', '/dev/null')
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n')
  return root
}

// Runs the CLI in a folder and returns status and combined output
export function cli(cwd, args, input) {
  const result = spawnSync(process.execPath, [join(PKG_ROOT, 'bin', 'cli.js'), ...args], { cwd, encoding: 'utf8', input })
  return { status: result.status, out: result.stdout + result.stderr }
}
