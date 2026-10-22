// ============================================================
// ROLE: Tests for the git hook checks and the commitlint command
// DEPENDS ON: lib/hooks.js, lib/sync.js, test/helpers.js, git
// USED BY: npm test, CI of the package
// KEY DECISIONS: hooks are called through the CLI, as Husky does, on real temp repos
// GOTCHAS: the commit-msg cases are the rules that bit in practice: capitals and perf
// LAST UPDATED: 2026-10-22 - first version
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { sync, PATTERNS_FILE } from '../lib/sync.js'
import { MAX_FILE_KB } from '../lib/hooks.js'
import { project, gitRepo, git, cli, fakeOpenspec } from './helpers.js'

// A synced project committed on main, then checked out on a work branch
function repo(branch = 'feature/x') {
  const root = gitRepo(project())
  sync(root)
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', 'chore: init')
  git(root, 'checkout', '-qb', branch)
  return root
}

test('pre-commit passes on a work branch with everything synced and staged', () => {
  const root = repo()
  writeFileSync(join(root, 'src.ts'), 'export {}\n')
  git(root, 'add', 'src.ts')
  assert.equal(cli(root, ['hook', 'pre-commit']).status, 0)
})

test('pre-commit blocks main, also before the first commit', () => {
  const root = gitRepo(project())
  sync(root)
  git(root, 'add', '-A')
  const { status, out } = cli(root, ['hook', 'pre-commit'])
  assert.equal(status, 1)
  assert.match(out, /Commit diretto su 'main'/)
})

test('pre-commit blocks files over the size limit', () => {
  const root = repo()
  writeFileSync(join(root, 'big.bin'), Buffer.alloc((MAX_FILE_KB + 1) * 1024))
  git(root, 'add', 'big.bin')
  const { status, out } = cli(root, ['hook', 'pre-commit'])
  assert.equal(status, 1)
  assert.match(out, /File troppo grande: big\.bin/)
})

test('pre-commit blocks hand-edited managed files', () => {
  const root = repo()
  writeFileSync(join(root, 'AGENTS.md'), 'edited')
  git(root, 'add', 'AGENTS.md')
  assert.match(cli(root, ['hook', 'pre-commit']).out, /non allineati: AGENTS\.md/)
})

test('pre-commit blocks regenerated files left out of the commit', () => {
  const root = repo()
  writeFileSync(join(root, PATTERNS_FILE), '# PATTERNS\n\n- SolidJS')
  sync(root)
  git(root, 'add', PATTERNS_FILE)
  const { status, out } = cli(root, ['hook', 'pre-commit'])
  assert.equal(status, 1)
  assert.match(out, /non in staging: git add .*AGENTS\.md/)
})

test('pre-commit blocks a project resolving another OpenSpec version', () => {
  const root = repo()
  fakeOpenspec(root, '0.1.0')
  assert.match(cli(root, ['hook', 'pre-commit']).out, /trova la versione 0\.1\.0/)
})

test('pre-push blocks pushes to protected branches, whatever is checked out', () => {
  const root = repo()
  const line = (remote) => `refs/heads/feature/x abc refs/heads/${remote} def\n`
  assert.equal(cli(root, ['hook', 'pre-push', 'origin', 'url'], line('feature/x')).status, 0)
  const { status, out } = cli(root, ['hook', 'pre-push', 'origin', 'url'], line('main'))
  assert.equal(status, 1)
  assert.match(out, /Push diretto su 'main'/)
  assert.equal(cli(root, ['hook', 'pre-push', 'origin', 'url'], line('develop')).status, 1)
})

test('pre-push without refs on stdin falls back to the current branch', () => {
  const root = repo()
  assert.equal(cli(root, ['hook', 'pre-push'], '').status, 0)
  git(root, 'checkout', '-q', 'main')
  assert.equal(cli(root, ['hook', 'pre-push'], '').status, 1)
})

test('commit-msg applies the package rules', () => {
  const root = repo()
  const msg = join(root, '.git', 'MSG')
  const check = (text) => {
    writeFileSync(msg, `${text}\n`)
    return cli(root, ['hook', 'commit-msg', msg]).status
  }
  assert.equal(check('feat(api): add hello endpoint'), 0)
  assert.equal(check('docs(spec): hello endpoint'), 0)
  assert.equal(check('Feat: Add endpoint'), 1)
  assert.equal(check('feat: Add endpoint with NestJS'), 1)
  assert.equal(check('perf: faster'), 1)
  assert.equal(check('feat: add endpoint.'), 1)
})

test('commitlint checks a commit range, as the CI does', () => {
  const root = repo()
  const base = git(root, 'rev-parse', 'HEAD')
  writeFileSync(join(root, 'a.ts'), '1')
  git(root, 'add', 'a.ts')
  git(root, 'commit', '-qm', 'feat: add a')
  assert.equal(cli(root, ['commitlint', '--from', base, '--to', 'HEAD']).status, 0)
  writeFileSync(join(root, 'b.ts'), '2')
  git(root, 'add', 'b.ts')
  git(root, 'commit', '-qm', 'WIP')
  assert.equal(cli(root, ['commitlint', '--from', base, '--to', 'HEAD']).status, 1)
})

test('unknown hook is an error', () => {
  assert.equal(cli(repo(), ['hook', 'post-merge']).status, 1)
})
