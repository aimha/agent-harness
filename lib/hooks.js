// ============================================================
// ROLE: Git hook checks run by the project's Husky hooks through the CLI
// DEPENDS ON: git, bash, lib/sync.js, lib/deps.js, lib/permissions.js, lib/commitlint.config.js,
//   lib/check-flow.sh (branch names)
// USED BY: bin/cli.js (hook pre-commit, hook pre-push, hook commit-msg, commitlint)
// KEY DECISIONS: the project's hooks call the package first and then run their own
//   checks, so the shared checks change with the package version.
//   pre-push reads the refs git passes on stdin, so pushing HEAD:main from another
//   branch is blocked too; with no stdin it falls back to the current branch. It also
//   checks the branch name with check-flow.sh --name, the rule the CI applies, so a bad
//   name fails before the push and not at the PR; tags and deletions are not checked.
//   Protected files are checked on ai/ branches only, as in Foundation: people change
//   them by hand on fix/ and feature/ branches. The list is the edit deny rules of the
//   composed opencode.json, evaluated with OpenCode's own matcher, except openspec/specs/,
//   which openspec archive writes in step 8 (hand edits stay denied to agents by OpenCode)
// GOTCHAS: hooks are skippable with --no-verify: CI and branch protection are the gate.
//   The protected check reads the rules from the package and opencode.local.json, not
//   from opencode.json on disk, so a hand-edited opencode.json cannot widen them.
//   The size limit counts bytes of the working-tree file, as git commits it; lockfiles
//   are exempt by file name, in any folder, since they grow with the dependencies
// LAST UPDATED: 2026-10-22 — branch names checked on pre-push
// ============================================================

import { execFileSync, spawnSync } from 'child_process'
import { existsSync, statSync, readFileSync } from 'fs'
import { basename, join } from 'path'
import { sync, composedOpencode, LOCK_FILE, PKG_ROOT } from './sync.js'
import { evaluate } from './permissions.js'
import { commitlintCli, projectProblems } from './deps.js'

// Branches nobody commits or pushes to directly
export const PROTECTED_BRANCHES = ['main', 'develop']

// Protected folders the flow itself writes on ai/ branches: openspec archive merges the
// deltas into the main specs, and a person writes the Purpose of a new capability there
export const WRITTEN_BY_FLOW = ['openspec/specs/']

// Largest file accepted in a commit, in kilobytes
export const MAX_FILE_KB = 500

// Lockfiles are generated and cannot be split: exempt from the size limit in any folder
export const SIZE_EXEMPT = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml']

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
    const { permission } = composedOpencode(root)
    const violations = touched.filter((rel) => evaluate(permission, 'edit', rel) === 'deny' && !WRITTEN_BY_FLOW.some((dir) => rel.startsWith(dir)))
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
    if (!existsSync(path) || SIZE_EXEMPT.includes(basename(rel))) continue
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

// Problem with a branch name as check-flow.sh judges it in CI; null when the name is accepted
function branchNameProblem(root, branch) {
  const script = join(PKG_ROOT, 'lib', 'check-flow.sh')
  const result = spawnSync('bash', [script, '--name', branch], { cwd: root, encoding: 'utf8' })
  if (result.status === 0) return null
  const message = `${result.stdout ?? ''}${result.stderr ?? ''}`.replace(/^❌\s+/, '').trim()
  return `${message || `Nome branch non controllabile: ${branch}`}\n    Rinomina il branch prima del push: git branch -m <nuovo-nome>`
}

// Checks before a push; refs is the stdin git gives the hook, one "<local> <sha> <remote> <sha>" per line
export function prePush(root, refs) {
  const pushes = refs
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((fields) => fields.length >= 4)
    .map(([, localSha, remoteRef]) => ({ localSha, remoteRef }))
  const targets = pushes.length ? pushes : [{ localSha: '', remoteRef: `refs/heads/${currentBranch(root)}` }]
  const problems = []
  for (const { localSha, remoteRef } of targets) {
    const branch = remoteRef.startsWith('refs/heads/') ? remoteRef.slice('refs/heads/'.length) : ''
    if (!branch) continue
    if (PROTECTED_BRANCHES.includes(branch)) {
      problems.push(`Push diretto su '${branch}' non consentito: usa una PR`)
      continue
    }
    // A deletion sends an all-zero local sha: removing a badly named branch must stay possible
    if (/^0+$/.test(localSha)) continue
    const problem = branchNameProblem(root, branch)
    if (problem) problems.push(problem)
  }
  return problems
}

// Runs the pinned commitlint with the package config; returns its exit code
export function commitlint(root, args) {
  const config = join(PKG_ROOT, 'lib', 'commitlint.config.js')
  return spawnSync(process.execPath, [commitlintCli(), '--config', config, ...args], { cwd: root, stdio: 'inherit' }).status ?? 1
}
