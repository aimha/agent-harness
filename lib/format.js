// ============================================================
// ROLE: Applies the project's Prettier to the managed Markdown and JSON files before they are written or checked
// DEPENDS ON: lib/prettier-worker.js, the project's package.json
// USED BY: lib/sync.js (plan)
// KEY DECISIONS: only when the project declares prettier in its root package.json, as
//   Foundation does: a project that formats its Markdown on commit (lint-staged) would
//   otherwise rewrite the generated files and break sync --check. YAML is left alone,
//   like Foundation's lint-staged does
// GOTCHAS: a managed file the project lists in .prettierignore stays as generated.
//   An unreadable package.json means no formatting: other checks report it, not this one
// LAST UPDATED: 2026-10-22 — first version
// ============================================================

import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const WORKER = join(dirname(fileURLToPath(import.meta.url)), 'prettier-worker.js')
const FORMATTED = /\.(md|mdc|json)$/

// Error raised when the project's Prettier fails on a managed file
export class FormatError extends Error {}

// Whether the project declares prettier among its root dependencies
export function projectUsesPrettier(root) {
  const path = join(root, 'package.json')
  if (!existsSync(path)) return false
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8'))
    return Boolean(pkg.dependencies?.prettier || pkg.devDependencies?.prettier)
  } catch {
    return false
  }
}

// Returns the files with Markdown and JSON formatted by the project's Prettier, when it has one
export function formatWithProject(root, files) {
  if (!projectUsesPrettier(root)) return files
  const targets = [...files].filter(([rel]) => FORMATTED.test(rel))
  const run = spawnSync(process.execPath, [WORKER], { input: JSON.stringify({ root, files: targets }), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (run.status !== 0) {
    const reason = run.stderr.trim().split('\n').find((line) => line.includes('Error')) ?? run.stderr.trim()
    throw new FormatError(`Prettier del progetto non è riuscito a formattare i file gestiti: ${reason}`)
  }
  const formatted = JSON.parse(run.stdout)
  return new Map([...files].map(([rel, content]) => [rel, formatted[rel] ?? content]))
}
