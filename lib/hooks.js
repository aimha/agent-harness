// ============================================================
// ROLE: Git hook checks run by the project's Husky hooks through the CLI
// DEPENDS ON: git, lib/sync.js, lib/deps.js, lib/permissions.js, lib/commitlint.config.js
// USED BY: bin/cli.js (hook pre-commit, hook pre-push, hook commit-msg, commitlint)
// KEY DECISIONS: the project's hooks call the package first and then run their own
//   checks, so the shared checks change with the package version.
//   pre-push reads the refs git passes on stdin, so pushing HEAD:main from another
//   branch is blocked too; with no stdin it falls back to the current branch.
//   Protected files are checked on ai/ branches only, as in Foundation: people change
//   them by hand on fix/ and feature/ branches. The list is the edit deny rules of the
//   composed opencode.json, evaluated with OpenCode's own matcher
// GOTCHAS: hooks are skippable with --no-verify: CI and branch protection are the gate.
//   The protected check reads the rules from the package and opencode.local.json, not
//   from opencode.json on disk, so a hand-edited opencode.json cannot widen them.
//   The size limit counts bytes of the working-tree file, as git commits it
// LAST UPDATED: 2026-10-22 — protected files on ai/ branches
// ============================================================

import { execFileSync, spawnSync } from 'child_process'
import { existsSync, statSync, readFileSync } from 'fs'
import { join } from 'path'
import { sync, plan, LOCK_FILE, PKG_ROOT } from './sync.js'
import { evaluate } from './permissions.js'
import { commitlintCli, projectProblems } from './deps.js'

// Branches nobody commits or pushes to directly
export const PROTECTED_BRANCHES = ['main', 'develop']

// Largest file accepted in a commit, in kilobytes
export const MAX_FILE_KB = 500

// Runs git in the project and returns its output
function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
}

// Name of the checked-out branch, also before the first commit; '' when detached
function currentBranch(root) {
  const result = spawnSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : ''
}

// Checks before a commit; returns the problems found, empty when the commit can go ahead
export function preCommit(root) {
  const problems = []
  const branch = currentBranch(root)
  if (PROTECTED_BRANCHES.includes(branch)) {
    problems.push(`Commit diretto su '${branch}' non consentito: apri un branch dedicato (feature/, fix/, chore/, spec/, ai/)`)
  }

  if (branch.startsWith('ai/')) {
    const touched = git(root, ['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean)
    const { permission } = JSON.parse(plan(root).get('opencode.json'))
    const violations = touched.filter((rel) => evaluate(permission, 'edit', rel) === 'deny')
    if (violations.length) {
      problems.push(
        `File protetti modificati su un branch ai/*:\n${violations.map((rel) => `     - ${rel}`).join('\n')}\n    ` +
          'Gli agenti non modificano questi file: segnalare la necessità nel summary come domanda aperta',
      )
    }
  }

  const staged = git(root, ['diff', '--cached', '--name-only', '-z', '--diff-filter=d']).split('\0').filter(Boolean)
  for (const rel of staged) {
    const path = join(root, rel)
    if (!existsSync(path)) continue
    const kb = Math.ceil(statSync(path).size / 1024)
    if (kb > MAX_FILE_KB) problems.push(`File troppo grande: ${rel} (${kb}KB > ${MAX_FILE_KB}KB). Suddividilo o usa git-lfs per gli asset binari`)
  }

  const { stale, orphans } = sync(root, { check: true })
  if (stale.length || orphans.length) {
    problems.push(`File gestiti da agent-harness non allineati: ${[...stale, ...orphans].join(', ')}. Esegui npx agent-harness sync`)
  } else {
    const managed = JSON.parse(readFileSync(join(root, LOCK_FILE), 'utf8')).files
    const unstaged = git(root, ['diff', '--name-only', '--', LOCK_FILE, ...managed]).split('\n').filter(Boolean)
    if (unstaged.length) problems.push(`File gestiti modificati ma non in staging: git add ${unstaged.join(' ')}`)
  }

  problems.push(...projectProblems(root))
  return problems
}

// Checks before a push; refs is the stdin git gives the hook, one "<local> <sha> <remote> <sha>" per line
export function prePush(root, refs) {
  const targets = refs
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[2])
    .filter(Boolean)
    .map((ref) => ref.replace(/^refs\/heads\//, ''))
  const branches = targets.length ? targets : [currentBranch(root)]
  return branches
    .filter((branch) => PROTECTED_BRANCHES.includes(branch))
    .map((branch) => `Push diretto su '${branch}' non consentito: usa una PR`)
}

// Runs the pinned commitlint with the package config; returns its exit code
export function commitlint(root, args) {
  const config = join(PKG_ROOT, 'lib', 'commitlint.config.js')
  return spawnSync(process.execPath, [commitlintCli(), '--config', config, ...args], { cwd: root, stdio: 'inherit' }).status ?? 1
}
