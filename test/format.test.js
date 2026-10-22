// ============================================================
// ROLE: Tests for formatting the managed files with the project's own Prettier
// DEPENDS ON: lib/format.js, lib/sync.js, prettier (devDependency, linked into temp projects)
// USED BY: npm test, CI of the package
// KEY DECISIONS: the fixture uses Foundation's prettier.config.js, the reference project;
//   expected output is computed with Prettier itself, so the test checks the wiring, not
//   Prettier's formatting choices
// GOTCHAS: the temp project links the package's own prettier into its node_modules, the
//   way a project would have it installed
// LAST UPDATED: 2026-10-22 — first version
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, readFileSync, symlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import * as prettier from 'prettier'
import { sync, plan, SyncError, PKG_ROOT } from '../lib/sync.js'
import { project, gitRepo, git, cli } from './helpers.js'

const FOUNDATION_CONFIG = `export default {
  singleQuote: true,
  semi: true,
  printWidth: 80,
  trailingComma: 'es5',
  tabWidth: 2,
};
`

// A project that declares prettier, has it installed and carries Foundation's config
function prettierProject() {
  const root = project()
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'p', type: 'module', devDependencies: { prettier: '3.8.3' } }))
  writeFileSync(join(root, 'prettier.config.js'), FOUNDATION_CONFIG)
  symlinkSync(join(PKG_ROOT, 'node_modules', 'prettier'), join(root, 'node_modules', 'prettier'), 'dir')
  return root
}

const read = (root, rel) => readFileSync(join(root, rel), 'utf8')

test('managed Markdown, Cursor rules and JSON come out as the project Prettier writes them', async () => {
  const root = prettierProject()
  sync(root)
  const options = { ...(await prettier.resolveConfig(join(root, 'AGENTS.md'))) }
  for (const [rel, parser] of [['AGENTS.md', 'markdown'], ['.cursor/rules/base.mdc', 'markdown'], ['.opencode/commands/opsx-new.md', 'markdown'], ['opencode.json', 'json']]) {
    const content = read(root, rel)
    assert.equal(await prettier.format(content, { ...options, parser }), content, `${rel} is not Prettier-clean`)
  }
})

test('formatting actually changes something on Foundation config, and check stays clean after sync', () => {
  const root = prettierProject()
  const raw = plan(project())
  const formatted = plan(root)
  const changed = [...formatted].filter(([rel, content]) => raw.get(rel) !== content).map(([rel]) => rel)
  assert.ok(changed.includes('AGENTS.md'), `expected AGENTS.md to be reformatted, changed: ${changed}`)
  sync(root)
  assert.deepEqual(sync(root, { check: true }).stale, [])
})

test('YAML is never formatted', () => {
  const root = prettierProject()
  assert.equal(plan(root).get('.github/workflows/agent-harness.yml'), readFileSync(join(PKG_ROOT, 'assets/files/.github/workflows/agent-harness.yml'), 'utf8'))
})

test('files listed in .prettierignore stay as generated', () => {
  const root = prettierProject()
  writeFileSync(join(root, '.prettierignore'), 'AGENTS.md\n')
  assert.equal(plan(root).get('AGENTS.md'), plan(project()).get('AGENTS.md'))
  assert.notEqual(plan(root).get('CLAUDE.md'), plan(project()).get('CLAUDE.md'))
})

test('a project that does not declare prettier gets the files unformatted', () => {
  const root = prettierProject()
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'p', type: 'module' }))
  assert.equal(plan(root).get('AGENTS.md'), plan(project()).get('AGENTS.md'))
})

test('a broken Prettier config is a readable sync error', () => {
  const root = prettierProject()
  writeFileSync(join(root, 'prettier.config.js'), 'export default {')
  assert.throws(() => plan(root), (error) => error instanceof SyncError && /Prettier del progetto/.test(error.message))
  assert.doesNotMatch(cli(root, ['sync']).out, /at .*\.js:\d+/)
})

test('pre-commit is clean after sync on a Prettier project', () => {
  const root = gitRepo(prettierProject())
  sync(root)
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', 'chore: init', '--no-verify')
  git(root, 'checkout', '-qb', 'feature/x')
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src', 'a.ts'), 'export {}\n')
  git(root, 'add', 'src/a.ts')
  assert.equal(cli(root, ['hook', 'pre-commit']).status, 0)
})
