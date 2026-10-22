// ============================================================
// ROLE: End-to-end test of the OpenSpec flow gate on a real temp repo
// DEPENDS ON: bin/cli.js (check-flow, openspec), lib/check-flow.sh, pinned OpenSpec, git
// USED BY: npm test, CI of the package
// KEY DECISIONS: one repo walks the whole flow in order (spec branch, merge, ai branch,
//   archive, Purpose), as a person would; each gate is checked at the step it guards
// GOTCHAS: OpenSpec rejects a Purpose shorter than 50 characters after archive, so the
//   fixture writes a real one
// LAST UPDATED: 2026-10-22 - first version, ported from the template flow simulation
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { sync } from '../lib/sync.js'
import { project, gitRepo, git, cli } from './helpers.js'

// Writes the artifacts of a change that adds one capability
function writeChange(root, name, { tasks = true } = {}) {
  const dir = join(root, 'openspec', 'changes', name)
  writeFileSync(join(dir, 'proposal.md'), '## Why\nSaluto.\n## What Changes\n- GET /hello\n## Capabilities\n### New Capabilities\n- `greeting`: saluto\n### Modified Capabilities\n## Non-goals\n- auth\n## Impact\n- nessuna\n')
  mkdirSync(join(dir, 'specs', 'greeting'), { recursive: true })
  writeFileSync(join(dir, 'specs', 'greeting', 'spec.md'), '## ADDED Requirements\n### Requirement: Saluto\nIl sistema SHALL rispondere a GET /hello con "ciao".\n#### Scenario: Risposta di saluto\n- **WHEN** il client chiama GET /hello\n- **THEN** la risposta è 200 con corpo "ciao"\n')
  writeFileSync(join(dir, 'design.md'), '## Context\nx\n## Decisions\n- d\n')
  if (tasks) writeFileSync(join(dir, 'tasks.md'), '## 1. Test\n- [x] 1.1 test\n')
}

// Commits everything with a message
function commit(root, message) {
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', message)
}

const flow = (root, branch) => cli(root, ['check-flow', branch, 'main', 'HEAD'])
const openspec = (root, ...args) => cli(root, ['openspec', ...args])

test('check-flow rejects unknown prefixes and non kebab-case names, listing every prefix', () => {
  const root = gitRepo(project())
  commit(root, 'chore: init')
  const { status, out } = flow(root, 'prova/x')
  assert.equal(status, 1)
  assert.match(out, /<ai\|spec\|feature\|fix\|chore>\/<kebab-case>/)
  assert.equal(flow(root, 'chore/Upper').status, 1)
  assert.equal(flow(root, 'chore/ok').status, 0)
  assert.equal(flow(root, 'feature/ok').status, 0)
  assert.equal(cli(root, ['check-flow', 'only-one-arg']).status, 1)
})

test('a change walks the whole flow and every gate holds at its step', () => {
  const root = gitRepo(project())
  sync(root)
  mkdirSync(join(root, 'openspec', 'specs'), { recursive: true })
  mkdirSync(join(root, 'openspec', 'changes', 'archive'), { recursive: true })
  writeFileSync(join(root, 'openspec', 'specs', '.gitkeep'), '')
  writeFileSync(join(root, 'openspec', 'changes', 'archive', '.gitkeep'), '')
  commit(root, 'chore: init')

  // Steps 1-4: spec branch, validated, reviewed before the plan exists
  git(root, 'checkout', '-qb', 'spec/hello-endpoint')
  assert.equal(openspec(root, 'new', 'change', 'hello-endpoint').status, 0)
  writeChange(root, 'hello-endpoint', { tasks: false })
  commit(root, 'docs(spec): hello endpoint')
  assert.equal(openspec(root, 'validate', 'hello-endpoint', '--strict', '--no-interactive').status, 0)
  assert.match(flow(root, 'spec/hello-endpoint').out, /tasks\.md/, 'spec PR stays red during review')

  // Step 5: the plan makes the spec PR mergeable
  writeFileSync(join(root, 'openspec', 'changes', 'hello-endpoint', 'tasks.md'), '## 1. Test\n- [x] 1.1 test\n')
  commit(root, 'docs(spec): tasks')
  assert.equal(flow(root, 'spec/hello-endpoint').status, 0)

  writeFileSync(join(root, 'stray.ts'), 'x')
  commit(root, 'docs: stray')
  assert.match(flow(root, 'spec/hello-endpoint').out, /fuori dal change:\nstray\.ts/)
  git(root, 'reset', '-q', '--hard', 'HEAD~1')
  appendFileSync(join(root, 'openspec', 'changes', 'hello-endpoint', 'design.md'), 'y\n')
  commit(root, 'feat: oops')
  assert.match(flow(root, 'spec/hello-endpoint').out, /solo commit di tipo docs/)
  git(root, 'reset', '-q', '--hard', 'HEAD~1')

  git(root, 'checkout', '-q', 'main')
  git(root, 'merge', '-q', '--no-ff', 'spec/hello-endpoint', '-m', 'merge spec')

  // Steps 6-7: implementation and summary, not archived yet
  git(root, 'checkout', '-qb', 'ai/hello-endpoint')
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src', 'hello.ts'), 'export const hello = () => "ciao"\n')
  mkdirSync(join(root, 'docs', 'summaries'), { recursive: true })
  writeFileSync(join(root, 'docs', 'summaries', 'hello-endpoint.md'), '# hello-endpoint\n')
  commit(root, 'feat(hello): endpoint')
  const unarchived = flow(root, 'ai/hello-endpoint')
  assert.equal(unarchived.status, 1)
  assert.match(unarchived.out, /npx openspec archive hello-endpoint --yes/)

  // Step 8: archive through the CLI, then a person writes the Purpose
  assert.equal(openspec(root, 'archive', 'hello-endpoint', '--yes').status, 0)
  commit(root, 'docs: archive hello-endpoint')
  assert.equal(flow(root, 'ai/hello-endpoint').status, 0)
  assert.ok(readdirSync(join(root, 'openspec', 'changes', 'archive')).some((name) => name.endsWith('-hello-endpoint')))

  const mainSpec = join(root, 'openspec', 'specs', 'greeting', 'spec.md')
  assert.equal(openspec(root, 'validate', '--all', '--strict', '--no-interactive').status, 1, 'placeholder Purpose keeps CI red')
  const purpose = (text) => writeFileSync(mainSpec, readFileSync(mainSpec, 'utf8').replace(/^## Purpose\n.*$/m, `## Purpose\n${text}`))
  purpose('Saluto via HTTP.')
  assert.equal(openspec(root, 'validate', '--all', '--strict', '--no-interactive').status, 1, 'a Purpose under 50 characters is still rejected')
  purpose('Risposta di saluto esposta via HTTP ai client, senza autenticazione.')
  commit(root, 'docs(specs): purpose of greeting')
  assert.equal(openspec(root, 'validate', '--all', '--strict', '--no-interactive').status, 0)
  assert.equal(openspec(root, 'validate', '--archived', '--no-interactive').status, 0)
})

test('a change without new behaviour passes with skip_specs', () => {
  const root = gitRepo(project())
  sync(root)
  commit(root, 'chore: init')
  git(root, 'checkout', '-qb', 'spec/tooling-lint')
  assert.equal(openspec(root, 'new', 'change', 'tooling-lint').status, 0)
  const dir = join(root, 'openspec', 'changes', 'tooling-lint')
  appendFileSync(join(dir, '.openspec.yaml'), 'skip_specs: true\n')
  writeFileSync(join(dir, 'proposal.md'), '## Why\nTooling.\n## What Changes\n- lint\n## Capabilities\n### New Capabilities\n### Modified Capabilities\n## Non-goals\n- nulla\n## Impact\n- nessuna\n')
  writeFileSync(join(dir, 'design.md'), '## Context\nx\n## Decisions\n- d\n')
  writeFileSync(join(dir, 'tasks.md'), '## 1. Lint\n- [x] 1.1 a\n')
  commit(root, 'docs(spec): tooling lint')
  assert.equal(openspec(root, 'validate', 'tooling-lint', '--strict', '--no-interactive').status, 0)
  assert.equal(flow(root, 'spec/tooling-lint').status, 0)
  assert.equal(existsSync(join(dir, 'specs')), false)
})
