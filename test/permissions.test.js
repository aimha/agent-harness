// ============================================================
// ROLE: Regression table for the base OpenCode permissions, evaluated as OpenCode does
// DEPENDS ON: lib/permissions.js, assets/opencode/permissions.json, lib/sync.js
// USED BY: npm test, CI of the package
// KEY DECISIONS: every case is a real command or path an agent may try; a change to the
//   base permissions that flips one of them must be deliberate and show up here
// GOTCHAS: the OpenCode build agent prepends its own read defaults (.env files ask); the
//   table checks the user config on top of them, as OpenCode evaluates it
// LAST UPDATED: 2026-10-22 — first version, from the template permission checks
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { evaluate, match } from '../lib/permissions.js'
import { composeOpencode, PKG_ROOT } from '../lib/sync.js'

const base = JSON.parse(readFileSync(join(PKG_ROOT, 'assets', 'opencode', 'permissions.json'), 'utf8'))

// OpenCode v1.19.3 build agent read defaults, placed before the user config
const READ_DEFAULTS = { '*': 'allow', '*.env': 'ask', '*.env.*': 'ask', '*.env.example': 'allow' }
const withDefaults = (permission) => ({ ...permission, read: { ...READ_DEFAULTS, ...permission.read } })

const CASES = [
  ['bash', 'npx openspec update', 'deny'],
  ['bash', 'npx --no -- openspec update', 'deny'],
  ['bash', 'npx openspec init', 'deny'],
  ['bash', 'npx openspec config set profile custom', 'deny'],
  ['bash', 'npx --no -- agent-harness openspec update', 'deny'],
  ['bash', 'npx agent-harness openspec config set profile core', 'deny'],
  ['bash', 'npx openspec archive hello --yes', 'allow'],
  ['bash', 'npx openspec validate hello --strict', 'allow'],
  ['bash', 'npx --no -- agent-harness openspec validate --all', 'ask'],
  ['bash', 'npm run test', 'allow'],
  ['bash', 'npm install', 'allow'],
  ['bash', 'npm install lodash', 'ask'],
  ['bash', 'git commit -m "x" --no-verify', 'deny'],
  ['bash', 'git checkout main', 'deny'],
  ['bash', 'git push origin ai/x', 'ask'],
  ['bash', 'find . -name x -delete', 'deny'],
  ['bash', 'rm -rf node_modules', 'deny'],
  ['read', '.env', 'deny'],
  ['read', '.env.local', 'deny'],
  ['read', '.envrc', 'deny'],
  ['read', 'apps/api/.env.production', 'deny'],
  ['read', '.env.example', 'allow'],
  ['read', 'apps/api/.env.example', 'allow'],
  ['read', 'src/app.environment.ts', 'allow'],
  ['edit', 'package.json', 'deny'],
  ['edit', 'packages/shared/package.json', 'deny'],
  ['edit', 'frontend/package-lock.json', 'deny'],
  ['edit', 'docker-compose.prod.yml', 'deny'],
  ['edit', '.env.local', 'deny'],
  ['edit', 'backend/.env', 'deny'],
  ['edit', '.envrc', 'deny'],
  ['edit', '.env.example', 'allow'],
  ['edit', 'backend/.env.example', 'allow'],
  ['edit', '.github/workflows/pr-check.yml', 'deny'],
  ['edit', 'openspec/specs/greeting/spec.md', 'deny'],
  ['edit', 'opencode.local.json', 'deny'],
  ['edit', 'agent-harness.lock.json', 'deny'],
  ['edit', '.husky/pre-commit', 'deny'],
  ['edit', 'src/main.ts', 'allow'],
  ['edit', 'GLOSSARY.md', 'allow'],
  ['edit', 'docs/summaries/ai/x.md', 'allow'],
]

test('base permissions decide each case as expected', () => {
  const permission = withDefaults(base.permission)
  const wrong = CASES.filter(([perm, input, want]) => evaluate(permission, perm, input) !== want)
    .map(([perm, input, want]) => `${perm} ${input}: ${evaluate(permission, perm, input)} (atteso ${want})`)
  assert.deepEqual(wrong, [])
})

test('project rules appended last can protect more and can lift a base rule', () => {
  const { permission } = composeOpencode(base, {
    permission: { edit: { '*/vite.config.*': 'deny', 'fluent-bit/*': 'deny', 'Makefile': 'allow' } },
  })
  assert.equal(evaluate(permission, 'edit', 'frontend/vite.config.js'), 'deny')
  // Patterns are anchored at the project root: a nested file needs the */ prefix
  assert.equal(evaluate(composeOpencode(base, { permission: { edit: { 'vite.config.*': 'deny' } } }).permission, 'edit', 'frontend/vite.config.js'), 'allow')
  assert.equal(evaluate(permission, 'edit', 'fluent-bit/fluent-bit.conf'), 'deny')
  assert.equal(evaluate(permission, 'edit', 'Makefile'), 'allow')
})

test('matcher follows OpenCode: star crosses folders, trailing " *" matches the bare command', () => {
  assert.ok(match('.github/workflows/ci.yml', '.github/*'))
  assert.ok(match('ls', 'ls *'))
  assert.ok(match('ls -la', 'ls *'))
  assert.ok(!match('lsof', 'ls *'))
  assert.ok(match('a\\b.txt', 'a/*'))
  assert.equal(evaluate({ edit: 'deny' }, 'edit', 'x'), 'deny')
  assert.equal(evaluate({}, 'edit', 'x'), 'ask')
})
