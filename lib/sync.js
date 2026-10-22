// ============================================================
// ROLE: Builds the files the package manages in a project, then writes or checks them
// DEPENDS ON: assets/ (guidelines, files, opencode permissions), package.json (version)
// USED BY: bin/cli.js (sync, sync --check), test/sync.test.js
// KEY DECISIONS: the package owns every path it generates and overwrites it on sync;
//   the project owns .agent-guidelines/PATTERNS.md and opencode.local.json, never touched.
//   agent-harness.lock.json records version and managed paths, so files the package
//   stops shipping are removed instead of lingering
// GOTCHAS: opencode.json key order is policy (OpenCode: last matching rule wins), so a
//   project rule that redefines a base pattern is moved to the end, not updated in place.
//   Paths read from the lock are validated: the lock lives in the project and is untrusted
// LAST UPDATED: 2026-10-22 - first version
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs'
import { join, dirname, isAbsolute } from 'path'
import { fileURLToPath } from 'url'

export const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = join(PKG_ROOT, 'assets')

// Paths inside a consuming project
export const LOCK_FILE = 'agent-harness.lock.json'
export const PATTERNS_FILE = '.agent-guidelines/PATTERNS.md'
export const LOCAL_OPENCODE_FILE = 'opencode.local.json'

const SEPARATOR = '\n\n---\n\n'

// Error with a message meant for the person running the command
export class SyncError extends Error {}

// Reads the version of the installed package
export function packageVersion() {
  return JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')).version
}

// Lists the files under a directory as posix paths relative to it, sorted
function walk(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      return entry.isDirectory() ? walk(join(dir, entry.name), rel) : [rel]
    })
    .sort()
}

// Parses a JSON file, naming the file in the error
function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new SyncError(`${label} non è JSON valido: ${error.message}`)
  }
}

// Package guidelines followed by the project's patterns, in the order agents read them
function guidelines(root) {
  const patternsPath = join(root, PATTERNS_FILE)
  if (!existsSync(patternsPath)) {
    throw new SyncError(`Manca ${PATTERNS_FILE}: è la parte delle regole che appartiene al progetto (stack, struttura, pattern)`)
  }
  const read = (path) => readFileSync(path, 'utf8').trim()
  return [
    read(join(ASSETS, 'guidelines', 'CORE.md')),
    read(join(ASSETS, 'guidelines', 'WORKFLOW.md')),
    read(patternsPath),
  ].join(SEPARATOR)
}

// Base OpenCode config followed by the project's, so project rules win under last-match-wins
export function composeOpencode(base, local) {
  const result = structuredClone(base)
  for (const [key, value] of Object.entries(local)) {
    if (key !== 'permission') {
      result[key] = value
      continue
    }
    result.permission ??= {}
    for (const [permission, rules] of Object.entries(value)) {
      const current = result.permission[permission]
      if (typeof rules === 'string' || typeof current !== 'object' || current === null) {
        result.permission[permission] = rules
        continue
      }
      const merged = { ...current }
      for (const [pattern, action] of Object.entries(rules)) {
        delete merged[pattern]
        merged[pattern] = action
      }
      result.permission[permission] = merged
    }
  }
  return result
}

// Every file the package manages in the project, as path -> expected content
export function plan(root) {
  const version = packageVersion()
  const banner = `<!-- GENERATED da @aimha/agent-harness@${version}: non modificare direttamente. Fonte: pacchetto agent-harness + ${PATTERNS_FILE} → npx agent-harness sync -->\n\n`
  const rules = guidelines(root)
  const files = new Map()

  files.set('AGENTS.md', `${banner}${rules}\n`)
  files.set('CLAUDE.md', `${banner}${rules}\n`)
  files.set('.cursor/rules/base.mdc', `---
description: Regole base — architettura, naming, workflow, pattern
alwaysApply: true
---

${banner}${rules}
`)

  const filesDir = join(ASSETS, 'files')
  for (const rel of walk(filesDir)) files.set(rel, readFileSync(join(filesDir, rel), 'utf8'))

  const base = readJson(join(ASSETS, 'opencode', 'permissions.json'), 'assets/opencode/permissions.json')
  const localPath = join(root, LOCAL_OPENCODE_FILE)
  const local = existsSync(localPath) ? readJson(localPath, LOCAL_OPENCODE_FILE) : {}
  files.set('opencode.json', `${JSON.stringify(composeOpencode(base, local), null, 2)}\n`)

  const managed = [...files.keys()].sort()
  files.set(LOCK_FILE, `${JSON.stringify({ package: '@aimha/agent-harness', version, files: managed }, null, 2)}\n`)
  return files
}

// Rejects lock entries that could point outside the project
function assertInsideProject(rel) {
  if (typeof rel !== 'string' || rel === '' || isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) {
    throw new SyncError(`${LOCK_FILE} contiene un percorso non valido: ${JSON.stringify(rel)}`)
  }
}

// Reads the lock left by the previous sync, if any
function readLock(root) {
  const path = join(root, LOCK_FILE)
  if (!existsSync(path)) return null
  const lock = readJson(path, LOCK_FILE)
  if (!Array.isArray(lock.files)) throw new SyncError(`${LOCK_FILE} non contiene l'elenco dei file`)
  lock.files.forEach(assertInsideProject)
  return lock
}

// Compares the project with the plan; writes and removes files unless check is set
export function sync(root, { check = false } = {}) {
  const files = plan(root)
  const lock = readLock(root)
  const current = (rel) => {
    const path = join(root, rel)
    return existsSync(path) ? readFileSync(path, 'utf8') : null
  }

  const stale = [...files].filter(([rel, content]) => current(rel) !== content).map(([rel]) => rel)
  const orphans = (lock?.files ?? []).filter((rel) => !files.has(rel) && existsSync(join(root, rel)))

  if (!check) {
    for (const rel of stale) {
      mkdirSync(dirname(join(root, rel)), { recursive: true })
      writeFileSync(join(root, rel), files.get(rel), 'utf8')
    }
    for (const rel of orphans) rmSync(join(root, rel))
  }

  return { version: packageVersion(), lockVersion: lock?.version ?? null, stale, orphans }
}

// Finds the consuming project: the folder holding the node_modules the package sits in
export function projectRoot(cwd = process.cwd()) {
  const scopeDir = dirname(PKG_ROOT)
  const nodeModules = dirname(scopeDir)
  return nodeModules.endsWith('node_modules') ? dirname(nodeModules) : cwd
}
