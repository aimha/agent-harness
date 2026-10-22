// ============================================================
// ROLE: Tests for the git hook checks and the commitlint command
// DEPENDS ON: lib/hooks.js, lib/sync.js, test/helpers.js, git
// USED BY: npm test, CI of the package
// KEY DECISIONS: hooks are called through the CLI, as Husky does, on real temp repos
// GOTCHAS: the commit-msg cases are the rules that bit in practice: capitals and perf
// LAST UPDATED: 2026-10-22 — lockfiles exempt from the size limit
// ============================================================

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync } from 'fs'
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

test('pre-commit lets lockfiles over the size limit through, at any depth', () => {
  const root = repo()
  mkdirSync(join(root, 'frontend'), { recursive: true })
  for (const rel of ['package-lock.json', 'frontend/package-lock.json']) {
    writeFileSync(join(root, rel), Buffer.alloc((MAX_FILE_KB + 1) * 1024))
    git(root, 'add', rel)
  }
  assert.equal(cli(root, ['hook', 'pre-commit']).status, 0)
})

test('pre-commit still checks a file that only resembles a lockfile', () => {
  const root = repo()
  writeFileSync(join(root, 'package-lock.json.bak'), Buffer.alloc((MAX_FILE_KB + 1) * 1024))
  git(root, 'add', 'package-lock.json.bak')
  assert.match(cli(root, ['hook', 'pre-commit']).out, /File troppo grande: package-lock\.json\.bak/)
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
  assert.equal(check('build(docker): pin the base image'), 0)
  assert.equal(check('revert: undo'), 1)
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

test('pre-commit on ai/ blocks protected files, project rules included, and lets the rest through', () => {
  const root = repo('ai/vault')
  writeFileSync(join(root, 'opencode.local.json'), JSON.stringify({ permission: { edit: { '*/vite.config.*': 'deny' } } }))
  sync(root)
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', 'chore: local rules', '--no-verify')
  const attempt = (rel, content = 'x') => {
    mkdirSync(join(root, rel, '..'), { recursive: true })
    writeFileSync(join(root, rel), content)
    git(root, 'add', rel)
    const result = cli(root, ['hook', 'pre-commit'])
    git(root, 'reset', '-q')
    return result
  }
  for (const rel of ['package.json', 'backend/package.json', 'frontend/vite.config.js', '.env.local', '.github/workflows/x.yml']) {
    const { status, out } = attempt(rel)
    assert.equal(status, 1, rel)
    assert.match(out, new RegExp(`File protetti modificati su un branch ai/\\*:\\n\\s+- ${rel.replaceAll('.', '\\.')}`), rel)
  }
  for (const rel of ['.env.example', 'backend/src/vault.service.ts', 'docs/summaries/ai/vault.md']) {
    assert.equal(attempt(rel).status, 0, rel)
  }
})

test('pre-commit leaves protected files to people on fix/ and feature/', () => {
  for (const branch of ['fix/r2-config', 'feature/r2']) {
    const root = repo(branch)
    writeFileSync(join(root, 'package.json'), '{}')
    git(root, 'add', 'package.json')
    assert.equal(cli(root, ['hook', 'pre-commit']).status, 0, branch)
  }
})

test('pre-commit on ai/ also blocks deleting a protected file', () => {
  const root = repo('chore/base')
  writeFileSync(join(root, 'Makefile'), 'all:\n')
  git(root, 'add', 'Makefile')
  git(root, 'commit', '-qm', 'chore: makefile', '--no-verify')
  git(root, 'checkout', '-qb', 'ai/drop')
  git(root, 'rm', '-q', 'Makefile')
  assert.match(cli(root, ['hook', 'pre-commit']).out, /- Makefile/)
})
